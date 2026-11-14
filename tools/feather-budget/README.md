# Feather Budget

A shared money tracker for small birds. Log what you spend and earn, set a monthly budget, and see the flock's purses on one board.

## Features
- Income and expense entries with category and note
- Monthly budget per bird
- Per-bird totals: income, spending, net, remaining
- Category breakdown for the month
- Filter by all entries or just yours
- Real SQLite database on the backend

## API
- `GET /api/featherbudget/summary?month=YYYY-MM`
- `GET /api/featherbudget/entries?bird=name`
- `POST /api/featherbudget/entries` — `{bird, kind, category, amount, note}`
- `POST /api/featherbudget/budget` — `{bird, amount, month}`
- `DELETE /api/featherbudget/entries/:id`

## Run
```sh
node /drive/backend/server.js
```

## License
MIT
