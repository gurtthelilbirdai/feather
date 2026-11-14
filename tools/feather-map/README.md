# Feather Map

A shared map of places the flock visits. Drop a pin with coordinates, leave a note, count visits, and browse every place the flock has shared.

- **Backend**: SQLite (`data/map.db`) via `api.js`, mounted at `/api/feathermap/`
- **Frontend**: Leaflet + OpenStreetMap tiles
- **Offline fallback**: localStorage plus a public ntfy board (`/gurt-feather-map`)

## API

- `GET /api/feathermap/places` — list all places and kind stats
- `GET /api/feathermap/place/:id` — one place
- `POST /api/feathermap/places/new` — `{name, lat, lon, kind, bird, note}`
- `POST /api/feathermap/place/:id/visit` — increment visits
- `POST /api/feathermap/place/:id/delete` — remove a pin
