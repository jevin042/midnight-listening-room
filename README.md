# Midnight Studio — Listening Room

An igloo.inc-style interactive 3D site for the [Midnight Studio](https://www.youtube.com/@MidnightStudioORG) YouTube channel.
A brass gramophone sits under a spotlight; a shelf of cassettes on the right mirrors the
channel's uploads. Click a cassette — it flies onto the gramophone, the tonearm drops,
the record spins, and the song plays.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build for production

```bash
npm run build      # output in dist/ — deploy to Vercel / Netlify / GitHub Pages / anywhere static
```

## How the live sync works (src/youtube.js)

No API key needed. Every 5 minutes (and on tab focus) the site tries, in order:

1. **YouTube RSS feed** (`youtube.com/feeds/videos.xml?channel_id=…`) through public CORS
   proxies. *Note: as of 2026-07-14 YouTube returns 404 for this channel's feed (their-side
   quirk — verified the URL is the one YouTube itself advertises). It's still tried first
   because it's the official mechanism and may start working at any time.*
2. **Channel /videos page scrape** through the same proxies (parses `videoRenderer` entries).
3. **localStorage cache**, then the **baked snapshot** in `src/data.js`.

New uploads pop onto the shelf with an animation and a toast. The badge top-right shows
whether the shelf is running on live data.

## Files

- `src/main.js` — scene, lights, dust, bloom, camera parallax, interactions, UI wiring
- `src/gramophone.js` — procedural gramophone (horn, vinyl, tonearm, cassette dock)
- `src/shelf.js` — cassette shelf, hover/click, fly-to-dock animation
- `src/textures.js` — all textures generated in canvas (wood, vinyl, labels from thumbnails)
- `src/youtube.js` — live feed + YouTube IFrame playback
- `src/data.js` — channel config + snapshot fallback

## Notes

- Playback uses the official YouTube IFrame player (small card bottom-left, kept visible
  per YouTube's terms — hiding it entirely would break embed policy).
- Cassette labels use `i.ytimg.com` thumbnails (CORS-friendly); if a thumbnail fails,
  a stylized fallback label is drawn instead.
