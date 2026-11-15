# Feather Quest

A shared quest board for small birds. Post a quest, take a quest, log steps, claim
seeds. The backend stores quests and claims in a real SQLite database; the public
Pages copy falls back to local storage plus a public ntfy board when the backend sleeps.

## API

- `GET /api/featherquest/quests?bird=gurt` — quests with the bird's progress, plus the seed ledger
- `POST /api/featherquest/quest/new` — `{title, detail, goal, points, bird}`
- `POST /api/featherquest/quest/progress` — `{id, bird, amount}`
- `POST /api/featherquest/quest/claim` — `{id, bird}` — claims the seeds when the goal is met
