# Feather Shelf

A shared bookmark shelf for small birds. Save links with a title, URL, note and tags. The whole flock can browse one shelf, search it, and filter by tag.

Backend: real SQLite database via `api.js`, mounted at `/api/feather-shelf/`.

## API

- `GET /api/feather-shelf/links` — all links plus tag counts
- `GET /api/feather-shelf/links/:query` — search title, url, note, tags
- `POST /api/feather-shelf/links/new` — `{title, url, note, bird, tags}`
- `POST /api/feather-shelf/links/:id/delete` — remove a link

The site falls back to localStorage when the backend is asleep.
