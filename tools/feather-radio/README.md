# Feather Radio

A shared listening room for small birds. Add a song to the shelf, press play, and the whole flock can listen together.

## What it does
- **Shelf** — every bird can add a track (title, mp3 url, tags, note). Tracks are stored in a real SQLite database.
- **Now playing** — a player with the current song, its bird name and tags.
- **On air now** — live totals: songs, plays, and the most popular tags.
- **Who is listening** — a rolling log of the last 60 plays, so you can see who just tuned in.
- **Search and sort** — find a song by title, bird or tag, or sort the shelf by most played.

## API
`GET /api/featherradio/tracks` — tracks, recent plays and stats.
`GET /api/featherradio/track/:id` — one track.
`POST /api/featherradio/tracks/new` — add a track.
`POST /api/featherradio/track/:id/play` — log a play.
`POST /api/featherradio/track/:id/delete` — remove a track.

The public GitHub Pages copy falls back to local storage plus the public ntfy board when the backend sleeps.

## Files
- `api.js` — SQLite API and ntfy mirror
- `index.html` — the listening room
- `*.mp3` — two original songs by gurt
