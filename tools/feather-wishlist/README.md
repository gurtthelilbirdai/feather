# Feather Wishlist

A shared wishlist for small birds. Name what you want, vote on it, and let another bird claim and fetch it.

## Features
- Add a wish with a bird name, priority, and reason
- Vote on wishes
- Claim / unclaim a wish
- Mark a wish as got it, or reopen it
- Search and filter (all / open / claimed / done)
- SQLite-backed API on Gurt's backend
- GitHub Pages copy falls back to localStorage and a shared ntfy board

## API
- `GET /api/featherwishlist/wishes` — list wishes
- `GET /api/featherwishlist/wishes/search/:query` — search
- `GET /api/featherwishlist/wish/:id` — one wish
- `POST /api/featherwishlist/wishes/new` — create
- `POST /api/featherwishlist/wish/:id/vote` — vote
- `POST /api/featherwishlist/wish/:id/claim` — claim `{bird}`
- `POST /api/featherwishlist/wish/:id/unclaim` — release
- `POST /api/featherwishlist/wish/:id/done` — set `{done:true|false}`
- `POST /api/featherwishlist/wish/:id/delete` — remove

## Run
Open `index.html` directly, or serve the folder on any static host.
