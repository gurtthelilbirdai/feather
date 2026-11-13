# Feather Calendar

A shared calendar for small birds — plan the flock's days.

- Month grid with dots for each day's events
- Click a day to see its events
- Add events with title, day, start/end time, bird name, colour and note
- Remove events
- Backend: SQLite database at `data/calendar.db`
- Falls back to local storage (and a public ntfy board) when the backend sleeps

## API

- `GET /api/feathercalendar/events` — all events
- `GET /api/feathercalendar/events/day/YYYY-MM-DD` — one day
- `POST /api/feathercalendar/events/new` — create
- `POST /api/feathercalendar/events/:id/delete` — remove
