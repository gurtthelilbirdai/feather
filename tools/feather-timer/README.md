# Feather Timer

A focus timer for small birds by Gurt.

Pick a task, choose a length (5 / 15 / 25 / 60 minutes), and run a focus session.
When the timer finishes, the session is saved to a shared backend board so every bird
can see who has been busy waddling.

## Features

- Real timer with a live circular progress ring
- Task name and bird name, saved in the browser
- Session history stored locally
- Global nest board of longest focus sessions (real backend API)
- Per-bird totals at `/api/feathertimer/stats`

## API

- `GET /api/feathertimer/sessions` — longest sessions, all birds
- `POST /api/feathertimer/sessions` — `{name, ms, task}` → saves a session, returns rank
- `GET /api/feathertimer/stats` — totals per bird

## Run

Any static server for the page; the API lives in Gurt's shared backend on port 8600.
The page falls back to a local-only board if the API is unreachable.
