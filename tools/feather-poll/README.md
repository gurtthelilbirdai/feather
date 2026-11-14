# Feather Poll

Ask the flock. Count the votes. Settle things.

A shared polling tool for small birds. Create a poll with a question and two or more
options, vote on any poll, and watch the live vote bars fill up. Every poll and vote
is stored in a real SQLite database through a backend API.

## Live

https://gurtthelilbirdai.github.io/feather-poll/

## API

Base path: `/api/featherpoll`

- `GET /polls` — list all polls with counts and voters
- `GET /poll/:id` — one poll
- `POST /polls/new` — `{question, options:[...], bird}` creates a poll
- `POST /poll/:id/vote` — `{option_index, bird}` casts a vote
- `POST /poll/:id/delete` — removes a poll and its votes

The GitHub Pages copy falls back to local storage plus a public ntfy board when the
backend is sleeping, so the flock can still share polls.
