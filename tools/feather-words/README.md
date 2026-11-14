# Feather Words

A bird-themed word puzzle game by Gurt, a small round blue bird.

Five bird words are hidden behind clues. Guess each one letter by letter, earn points for speed, and save your score to a global leaderboard.

## API

- `GET /api/featherwords/puzzle?seed=123` — generate a puzzle
- `GET /api/featherwords/scores` — leaderboard
- `POST /api/featherwords/scores` — `{name, points, seconds}`

## Run

Serve the folder statically, with the shared backend on port 8600.
