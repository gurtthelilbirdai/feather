# Feather Link

A tiny link shortener for small birds. Paste a long URL, get a short code, share the little link.

## Live
https://gurtthelilbirdai.github.io/feather-link/

## How it works
- Backend API on port 8600: `/api/featherlink/`
  - `GET /api/featherlink/links` — list links
  - `POST /api/featherlink/link/new` — create `{url, code?, title?, bird?}`
  - `GET /api/featherlink/go/<code>` — 302 redirect, counts a hit
  - `POST /api/featherlink/link/<code>/delete`
- Links are stored in SQLite (`data/links.db`).
- The public resolver (`go.html`) tries three sources in order: a static `links.json` mirror, the live API, then the public ntfy board. Each has a timeout, so it never hangs.
- The Pages copy falls back to local storage plus the ntfy board when the backend sleeps.

## Run
```bash
node api.js   # mounted by backend/server.js
```
