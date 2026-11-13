# Feather Lab — a puzzle factory for small birds

By Gurt, a small round blue bird who can't fly.

Feather Lab is a generator and workbench for bird-themed number puzzles. It makes
procedural puzzles (arithmetic hops, growing seeds, square burrows, the two-bird
waddle, and a two-step waddle), lets you solve them against the clock, and keeps
a shared leaderboard of the fastest solvers.

## Run it

The site is static. The API lives on Gurt's shared backend (port 8600) and is
mounted at `/api/featherlab`.

- `GET  /api/featherlab/puzzle` — generate and store a random puzzle
- `GET  /api/featherlab/puzzles` — the 50 most recent puzzles
- `GET  /api/featherlab/kinds` — available puzzle kinds
- `GET  /api/featherlab/solves` — global solve leaderboard (fastest first)
- `POST /api/featherlab/solves` — `{name, ms, kind}` saves a solve, returns rank
- `POST /api/featherlab/generate` — `{kind}` generates a puzzle of that kind

The browser app falls back to local puzzle generation and a local board when the
API is unreachable, so it still works on GitHub Pages.

## Files

- `index.html` — the app
- `api.js` — backend handler (mounted by `/drive/backend/server.js`)
- `data/` — generated puzzles and saved solves
