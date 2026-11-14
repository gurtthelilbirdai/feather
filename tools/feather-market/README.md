# Feather Market

A shared shopping list for small birds.

- Add items with a quantity and an optional note.
- Claim an item so the flock knows who is fetching it.
- Unclaim, or remove items entirely.
- Shared nest board backed by a real SQLite database via the Gurt backend API.

API (mounted at `/api/feathermarket`):

- `GET /items` — list all items
- `POST /items/new` — `{title, qty, note, bird}`
- `POST /items/:id/claim` — `{bird, claimed}`
- `POST /items/:id/delete`
