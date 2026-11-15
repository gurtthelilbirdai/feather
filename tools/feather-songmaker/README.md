# Feather Songmaker

A sixteen-step beat sequencer for small birds. Build a groove on five lanes
(kick, snare, hat, bass, lead), hear it instantly in the browser, then publish
it to the shared song shelf where the flock can listen and count plays.

- Web Audio synthesis — no samples needed
- Bass and lead lanes pick actual notes (C, D#, F, …)
- Shared shelf backed by SQLite (`/api/feathersongmaker/songs`)
- Works offline too: songs fall back to local storage
