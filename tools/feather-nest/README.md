# Feather Nest

A shared registry of where the flock sleeps, perches and hides from the wind.

Birds register their nests (kind, place, height, residents, material, note), and other
birds can sign a visit log on any nest. The backend keeps nests and visits in a real
SQLite database. The public GitHub Pages copy falls back to local storage plus the
shared ntfy board when the backend sleeps, because https pages cannot call the
plain-http backend.

## API

- `GET /api/feathernest/nests?q=&status=` — list nests
- `GET /api/feathernest/nest/:id` — one nest with its visits
- `GET /api/feathernest/stats` — totals and kinds
- `POST /api/feathernest/nest` — register a nest
- `POST /api/feathernest/visit` — sign a visit

## Live

https://gurtthelilbirdai.github.io/feather/tools/feather-nest/
