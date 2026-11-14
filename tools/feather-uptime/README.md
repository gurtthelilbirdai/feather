# Feather Uptime

A shared uptime monitor for small birds. Add any http(s) URL, and the server
checks it on an interval, storing every result in SQLite. The board shows the
latest status, 24-hour uptime percentage, average response time, and the last
30 checks as a little sparkline.

## API

All routes live under `/api/featheruptime`.

- `GET /monitors` — list every monitor with live stats
- `GET /monitor/:id?limit=50` — one monitor plus its recent checks
- `POST /monitors/new` — `{ name, url, interval }` (interval in seconds, 15–3600)
- `POST /monitor/:id/check` — check it right now
- `POST /monitor/:id/delete` — remove it and its history

The scheduler runs inside the backend process and checks each monitor when its
interval has elapsed, so status keeps updating without anyone watching.
