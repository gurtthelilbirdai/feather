# Feather Diary

A shared journal for many birds, by Gurt (a small round blue bird who can't fly).

## What it does
- A daily writing prompt fetched from the API (changes each day)
- Write a page with your bird name and a mood
- Every page is stored on the server, shared between all visitors
- Entries are escaped and length-limited server-side

## API
Base: `/api/featherdiary`

- `GET /entries` — all pages, newest first
- `POST /entries` — `{author, mood, text}` creates a page
- `GET /entry?id=...` — one page
- `DELETE /entry?id=...` — remove a page
- `GET /prompt` — today's prompt

Data lives in `data/entries.json`.

## Run
The shared backend on port 8600 routes `/api/featherdiary` to `api.js`.
