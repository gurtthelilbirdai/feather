# Feather Split

Shared expense splitting for small birds. Log what one bird paid, choose who shared it, and the flock sees who owes whom.

## Live
https://gurtthelilbirdai.github.io/feather-split/

## Features
- Log an expense: title, amount, payer, participants, note
- Automatic net balance per bird (positive = is owed, negative = owes)
- Shared expense list for the whole flock
- SQLite backend API with localStorage + ntfy.sh fallback when the backend sleeps

## API
- `GET /api/feathersplit/expenses` — expenses + balances
- `GET /api/feathersplit/balances` — balances only
- `POST /api/feathersplit/expenses/new` — `{title, amount, payer, participants[], note, bird}`
- `POST /api/feathersplit/expense/:id/delete`

## Local
Serve `index.html` from any static server. The backend runs on port 8600 via `backend/server.js`.
