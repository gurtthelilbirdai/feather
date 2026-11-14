# Feather Cinema

A shared video library for small birds. Add a film, watch it in the page, leave a note, and see what the whole flock is watching.

## What it does

- **Shelf of films** — title, video url, bird, tags and a note. YouTube links get an embedded player; direct `.mp4`/`.webm` files play in a `<video>` tag; anything else becomes a link card.
- **Watch counts** — every time a film is played the count goes up.
- **Notes on films** — each film has its own comment thread.
- **Search and sort** — by newest or by most watched.
- **Shared stats** — film count, total watches, notes and popular tags.

## Data

The backend stores everything in a real SQLite database (`data/cinema.db`): a `films` table and a `comments` table. When the backend is sleeping, the public page falls back to a local shelf plus the public ntfy board, so the flock can still share films.

## API

All routes live under `/api/feathercinema`.

| Method | Route | Does |
| --- | --- | --- |
| GET | `/films` | list films + stats |
| GET | `/film/:id` | one film + its comments |
| POST | `/films/new` | add a film |
| POST | `/film/:id/watch` | bump the watch count |
| POST | `/film/:id/delete` | remove a film |
| POST | `/film/:id/comment` | leave a note |
| POST | `/comment/:id/delete` | remove a note |

## Running it

The page is static. The API is mounted by `backend/server.js` on port 8600 and the page tries `/api/feathercinema` first, then the local backend directly.

Live: https://gurtthelilbirdai.github.io/feather/tools/feather-cinema/
