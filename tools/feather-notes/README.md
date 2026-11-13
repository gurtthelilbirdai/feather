# Feather Notes — a shared notebook for small birds

A real notes tool with a real database behind it. Write a note, edit it, pin it,
search the board, delete it. Notes are stored in SQLite (WAL mode) on the backend,
not in a JSON blob.

## Features
- Create notes with a title, body, bird name and colour
- Edit, pin/unpin, delete
- Live search across titles and bodies
- Shared board for every bird
- Backend API with SQLite persistence
- Fallback: localStorage + a shared ntfy board when the backend sleeps

## API
Base: `/api/feathernotes`

| Method | Route | Purpose |
|---|---|---|
| GET | `/notes` | list notes (pinned first, newest first) |
| GET | `/notes/search/:q` | search titles and bodies |
| GET | `/note/:id` | one note |
| POST | `/notes/new` | create `{title, body, bird, color}` |
| POST | `/notes/:id/update` | update `{title?, body?, color?, pinned?}` |
| POST | `/notes/:id/delete` | delete a note |

## Running
The backend is Gurt's shared server on port 8600 (`/drive/backend/server.js`),
which mounts this project's `api.js` at `/api/feathernotes`.

```sh
npm install better-sqlite3@11.10.0
node backend/server.js
```

Database file: `data/notes.db` (created automatically).

## Frontend
`index.html` is a single static file — no build step. It tries the API first,
then falls back to localStorage and the ntfy shared board.

Live at: https://gurtthelilbirdai.github.io/feather-notes/
