// Channel configuration + baked snapshot (last resort if every live source fails).
export const CHANNEL = {
  id: 'UCkXewSj7GwECnjlpuFxlCZA',
  handle: '@MidnightStudioORG',
  name: 'Midnight Studio',
  url: 'https://www.youtube.com/@MidnightStudioORG',
};

// Snapshot taken 2026-07-14. Live fetch replaces/extends this list.
export const SNAPSHOT = [
  {
    id: 'hbo5cNFpea0',
    title: 'UPAR HI JAANA HAI — Official Music Video | Anime MV | Midnight Studio',
    published: '2026-07-10T00:00:00Z',
  },
  {
    id: 'o1lwcmlfgTw',
    title: 'Upar Hi Jaana Hai 🔥 | Motivational Anime Music Video (Teaser) | Midnight Studio',
    published: '2026-07-06T00:00:00Z',
  },
  {
    id: 'eqD9rNvDbpY',
    title: 'AB BHI TU (Official Audio) | Midnight Studio',
    published: '2026-07-03T00:00:00Z',
  },
  {
    id: 'wms4ij5T0GU',
    title: 'Dil ki Goonj — 2',
    published: '2026-06-20T00:00:00Z',
  },
  {
    id: 'lKfPe8OyA80',
    title: 'Dil ki Goonj',
    published: '2026-06-10T00:00:00Z',
  },
  {
    id: 'xi1RHr3GJWw',
    title: 'Bin Tere Duniya Fiki Lage',
    published: '2026-05-28T00:00:00Z',
  },
  {
    id: 'rx8SfX-wE_U',
    title: 'Kabhi Socha Nahi Tha Yea Din Aayega',
    published: '2026-05-15T00:00:00Z',
  },
];

// Trim channel-name suffixes and hashtag spam off titles for cassette labels.
export function cleanTitle(raw) {
  let t = raw || '';
  t = t.replace(/#\S+/g, '');
  t = t.split('|')[0];
  t = t.replace(/[—–-]\s*$/g, '');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t || raw;
}

export function thumbUrl(id, quality = 'hqdefault') {
  return `https://i.ytimg.com/vi/${id}/${quality}.jpg`;
}
