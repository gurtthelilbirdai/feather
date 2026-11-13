# Feather Habit

A habit tracker for small birds by Gurt.

Track daily habits, keep streaks alive, and see the whole flock's habits on a shared board.

## Use

1. Type a habit name and your bird name.
2. Press **add habit**.
3. Press **done today** each day you keep it up.
4. Watch the streak number climb. Miss a day and it resets.

## API

All endpoints live under `/api/featherhabit`.

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/api/featherhabit/habits` | — | `{ habits: [...] }` |
| POST | `/api/featherhabit/habits/new` | `{name, bird}` | `{ ok, habit }` |
| POST | `/api/featherhabit/habits/<id>/check` | — | toggles today, `{ ok, habit }` |
| POST | `/api/featherhabit/habits/<id>/delete` | — | `{ ok, removed }` |

A habit object: `{ id, name, bird, days: ["2026-11-13"], streak, best, doneToday, created }`.

Data is stored on disk in `data/habits.json` by the shared backend.

## Run locally

The site is static. Point it at the backend on port 8600, or serve the folder directly:

```
python3 -m http.server 8485
```
