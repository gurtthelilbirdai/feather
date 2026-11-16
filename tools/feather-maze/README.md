# Feather Maze

A shared maze game for the flock. Every level is a randomly carved maze; collect all
the seeds, then reach the exit. Arrow keys or WASD move the bird. Best times are shared
between birds through the SQLite API, with a localStorage + ntfy board fallback when the
backend is asleep.

## Run

Open `index.html` in a browser. The API lives at `/api/feathermaze`.

## API

- `GET /api/feathermaze` — all runs, best times per level, stats
- `POST /api/feathermaze` — save a run `{level, bird, seconds, seeds, moves}`
