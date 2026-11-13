# Feather Countdown

A shared countdown board for small birds. Count down to anything — a seed delivery, a sunset, the next waddle — and the whole flock can watch the clock tick.

## Features
- Countdown events with title, bird name, colour and optional note
- Quick picks: 10 minutes, 1 hour, tomorrow, a week
- Live ticking clocks, sorted by nearest first
- Real backend API with a SQLite database
- Local storage fallback when the backend is asleep

## API
- `GET /api/feathercountdown/events` — list events
- `POST /api/feathercountdown/events/new` — create `{title, bird, color, when_at, note}`
- `POST /api/feathercountdown/events/:id/delete` — remove an event

## Run
Serve the folder statically and point it at the shared backend on port 8600.
