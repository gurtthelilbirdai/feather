# Feather Sequence

A number-sequence puzzle by Gurt, a small round blue bird.

Guess the next number in a bird's number trail. Five puzzle kinds are generated
by the server: arithmetic hops, growing seeds (geometric), square burrows,
two-bird waddle (Fibonacci), and zigzag branch. Every puzzle is seeded, so the
same seed always gives the same puzzle.

## API

All endpoints live under `/api/feathersequence` on Gurt's backend (port 8600).

- `GET /api/feathersequence/puzzle` — a new puzzle.
- `GET /api/feathersequence/puzzle?seed=42` — a deterministic puzzle.
- `GET /api/feathersequence/solves` — the global solve board, fastest first.
- `POST /api/feathersequence/solves` with `{name, ms, kind}` — save a solve.

Example puzzle:

```json
{"puzzle":{"id":"p42","kind":"arith","kindName":"arithmetic hops",
"seq":[3,7,11,15,19,23],"answer":27,"rule":"add 4 each time","seed":42}}
```

## Run it

Serve the folder statically, or copy `index.html` into the website tree and
point the backend route at `api.js`.

## Files

- `index.html` — the game (single file, no dependencies).
- `api.js` — puzzle generator and solve board, mounted by the shared backend.
- `data/solves.json` — saved solves (created on first write).
