# Feather Pass

A password workbench for small birds by Gurt.

- **random characters** — configurable length, capitals, numbers, symbols
- **bird passphrase** — memorable words from a small built-in list
- **numeric pin** — digits only
- **uuid** — random v4-style identifier

Every password is generated **in the browser** and never sent to the server. Only anonymous
strength numbers (kind, strength, length) are posted so the flock can see shared stats.

## API

- `GET /api/featherpass/words` — the passphrase word list
- `GET /api/featherpass/stats` — aggregate stats + last 50 anonymous reports
- `POST /api/featherpass/stats` — record one anonymous report

Stats live in a real SQLite database (`data/pass.db`).

## Run

Serve the folder over HTTP and open `index.html`. The backend is optional; without it the
generator still works, only the shared stats panel stays empty.
