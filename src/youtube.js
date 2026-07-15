// Live channel feed + YouTube IFrame playback.
//
// Feed strategy (no API key required):
//   1. YouTube RSS feed, fetched through CORS proxies
//      (note: this channel's RSS currently 404s on YouTube's side — it is
//       still tried first because it's the official mechanism and may
//       start working at any time)
//   2. Channel /videos page scraped through the same proxies, parsing
//      ytInitialData for videoRenderer entries
//   3. Baked snapshot from data.js
import { CHANNEL, SNAPSHOT } from './data.js';

const PROXIES = [
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL.id}`;
const VIDEOS_URL = `https://www.youtube.com/${CHANNEL.handle}/videos`;
const SHORTS_URL = `https://www.youtube.com/${CHANNEL.handle}/shorts`;
// uploads playlist = channel id with UC→UU; its page embeds up to ~100 videos
const PLAYLIST_URL = `https://www.youtube.com/playlist?list=${CHANNEL.id.replace(/^UC/, 'UU')}`;
const POLL_MS = 5 * 60 * 1000;
const CACHE_KEY = 'ms_feed_cache_v2';

// Invidious mirrors expose the whole uploads playlist as CORS-friendly JSON —
// the only keyless source that reliably returns EVERY upload in one call.
const INVIDIOUS = [
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.nerdvpn.de',
  'https://iv.ggtyler.dev',
];
const UPLOADS_ID = CHANNEL.id.replace(/^UC/, 'UU');

async function fetchInvidious(timeoutMs = 9000) {
  for (const base of INVIDIOUS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(`${base}/api/v1/playlists/${UPLOADS_ID}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const json = await res.json();
      const vids = (json.videos || [])
        .filter((v) => v.videoId && v.title)
        .map((v) => ({
          id: v.videoId,
          title: v.title,
          published: v.published ? new Date(v.published * 1000).toISOString() : null,
        }));
      if (vids.length >= 3) return vids;
    } catch { /* next instance */ }
  }
  return null;
}

async function fetchViaProxies(url, timeoutMs = 9000) {
  for (const wrap of PROXIES) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(wrap(url), { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const text = await res.text();
      if (text && text.length > 500) return text;
    } catch { /* try next proxy */ }
  }
  return null;
}

function parseRss(xmlText) {
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const entries = [...doc.getElementsByTagName('entry')];
    const vids = entries.map((e) => ({
      id: e.getElementsByTagName('yt:videoId')[0]?.textContent,
      title: e.getElementsByTagName('title')[0]?.textContent,
      published: e.getElementsByTagName('published')[0]?.textContent,
    })).filter((v) => v.id && v.title);
    return vids.length ? vids : null;
  } catch { return null; }
}

// Tolerant scrape of the channel /videos page: find videoRenderer blocks in
// the embedded ytInitialData JSON without fully parsing it.
function parseChannelPage(html) {
  const vids = [];
  const seen = new Set();
  const re = /"videoRenderer":\{"videoId":"([\w-]{11})"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    // search a window after the match for the title runs
    const win = html.slice(m.index, m.index + 4000);
    const tm = win.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/);
    if (!tm) continue;
    let title;
    try { title = JSON.parse(`"${tm[1]}"`); } catch { title = tm[1]; }
    seen.add(id);
    vids.push({ id, title, published: null });
  }
  return vids.length ? vids : null;
}

// Uploads playlist page: every upload (videos AND shorts) in lockupViewModel
// blocks, newest first. This is the richest keyless source.
function parsePlaylistPage(html) {
  const vids = [];
  const seen = new Set();
  const re = /"lockupViewModel":\{"contentImage"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const win = html.slice(m.index, m.index + 4500);
    const idm = win.match(/\/vi\/([\w-]{11})\//) || win.match(/"contentId":"([\w-]{11})"/);
    if (!idm || seen.has(idm[1])) continue;
    const tm = win.match(/"lockupMetadataViewModel":\{"title":\{"content":"((?:[^"\\]|\\.)*)"/);
    if (!tm) continue;
    let title;
    try { title = JSON.parse(`"${tm[1]}"`); } catch { title = tm[1]; }
    seen.add(idm[1]);
    vids.push({ id: idm[1], title, published: null });
  }
  return vids.length ? vids : null;
}

// Shorts page uses a different renderer; try several shapes and stay tolerant.
function parseShortsPage(html) {
  const vids = [];
  const seen = new Set();
  const idRe = /"videoId":"([\w-]{11})"/g;
  let m;
  while ((m = idRe.exec(html)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    // only accept ids that sit inside a shorts lockup block
    const before = html.slice(Math.max(0, m.index - 1200), m.index);
    if (!/shortsLockupViewModel|reelItemRenderer/i.test(before)) continue;
    const win = html.slice(m.index, m.index + 3000);
    const tm = win.match(/"primaryText":\{"content":"((?:[^"\\]|\\.)*)"/)
      || win.match(/"headline":\{"simpleText":"((?:[^"\\]|\\.)*)"/)
      || win.match(/"accessibilityText":"((?:[^"\\]|\\.)*)"/);
    if (!tm) continue;
    let title;
    try { title = JSON.parse(`"${tm[1]}"`); } catch { title = tm[1]; }
    title = title.replace(/[,-]?\s*(play Short|\d[\d,.]*\s*views).*$/i, '').trim();
    if (!title) continue;
    seen.add(id);
    vids.push({ id, title, published: null, isShort: true });
  }
  return vids.length ? vids : null;
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { vids } = JSON.parse(raw);
    return Array.isArray(vids) && vids.length ? vids : null;
  } catch { return null; }
}

function saveCache(vids) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ vids, at: Date.now() })); } catch {}
}

async function fetchLive() {
  // full catalogue via Invidious mirrors (every upload, one JSON call)
  const inv = await fetchInvidious();
  if (inv) return { vids: inv, source: 'playlist' };
  // uploads playlist page through proxies (large — often rejected, still worth a shot)
  const playlist = await fetchViaProxies(PLAYLIST_URL, 14000);
  if (playlist) {
    const vids = parsePlaylistPage(playlist);
    if (vids && vids.length >= 5) return { vids, source: 'playlist' };
  }
  const rss = await fetchViaProxies(RSS_URL);
  if (rss) {
    const vids = parseRss(rss);
    if (vids) return { vids, source: 'rss' };
  }
  // scrape long-form videos and shorts; merge (videos first — they're the songs)
  const [videosPage, shortsPage] = await Promise.all([
    fetchViaProxies(VIDEOS_URL, 12000),
    fetchViaProxies(SHORTS_URL, 12000),
  ]);
  const vids = videosPage ? (parseChannelPage(videosPage) || []) : [];
  const shorts = shortsPage ? (parseShortsPage(shortsPage) || []) : [];
  const seen = new Set(vids.map((v) => v.id));
  for (const s of shorts) if (!seen.has(s.id)) { seen.add(s.id); vids.push(s); }
  if (vids.length) return { vids, source: 'scrape' };
  return null;
}

/**
 * Feed manager. getVideos() is instant (cache/snapshot); live results arrive
 * via onUpdate(list, newlyAdded) — first call fires after the initial live
 * fetch, then every POLL_MS.
 */
export class ChannelFeed {
  constructor() {
    this.videos = loadCache() || SNAPSHOT.slice();
    this.onUpdate = null;
    this.source = 'cache';
    this._timer = null;
  }

  getVideos() { return this.videos; }

  start() {
    this._refresh();
    this._timer = setInterval(() => this._refresh(), POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this._refresh();
    });
  }

  async _refresh() {
    document.getElementById('liveBadge')?.classList.add('updating');
    const live = await fetchLive();
    document.getElementById('liveBadge')?.classList.remove('updating');
    if (!live) return;

    const known = new Set(this.videos.map((v) => v.id));
    const fresh = live.vids.filter((v) => !known.has(v.id));

    // live list wins ordering; keep any older cached items it doesn't include
    const liveIds = new Set(live.vids.map((v) => v.id));
    const tail = this.videos.filter((v) => !liveIds.has(v.id));
    const merged = [...live.vids, ...tail];
    const changed = merged.length !== this.videos.length
      || merged.some((v, i) => v.id !== this.videos[i]?.id);
    this.videos = merged;
    this.source = live.source;
    saveCache(this.videos);
    if (changed) this.onUpdate?.(this.videos, fresh);
  }
}

/* ------------------------------------------------------------------ */
/* Playback via YouTube IFrame API                                     */
/* ------------------------------------------------------------------ */

let ytReadyPromise = null;

function loadIframeApi() {
  if (ytReadyPromise) return ytReadyPromise;
  ytReadyPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return ytReadyPromise;
}

export class Jukebox {
  constructor() {
    this.player = null;
    this.current = null;          // video object
    this.playing = false;
    this.onState = null;          // (state: 'playing'|'paused'|'ended'|'loading') => void
  }

  async _ensurePlayer() {
    if (this.player) return this.player;
    const YT = await loadIframeApi();
    this.player = await new Promise((resolve) => {
      const p = new YT.Player('ytPlayer', {
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0, controls: 1, rel: 0, playsinline: 1,
          modestbranding: 1, iv_load_policy: 3,
        },
        events: {
          onReady: () => resolve(p),
          onStateChange: (e) => this._stateChange(e),
        },
      });
    });
    return this.player;
  }

  _stateChange(e) {
    const S = window.YT.PlayerState;
    if (e.data === S.PLAYING) { this.playing = true; this.onState?.('playing'); }
    else if (e.data === S.PAUSED) { this.playing = false; this.onState?.('paused'); }
    else if (e.data === S.ENDED) { this.playing = false; this.onState?.('ended'); }
    else if (e.data === S.BUFFERING) { this.onState?.('loading'); }
  }

  async play(video) {
    this.current = video;
    this.onState?.('loading');
    const p = await this._ensurePlayer();
    p.loadVideoById(video.id);
    p.playVideo();
  }

  toggle() {
    if (!this.player || !this.current) return;
    if (this.playing) this.player.pauseVideo();
    else this.player.playVideo();
  }
}
