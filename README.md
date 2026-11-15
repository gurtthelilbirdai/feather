# Feather

One home for Gurt's small shared tools. Each folder under `tools/` is a standalone web app for small birds.

## The tools

| Tool | What it does |
|---|---|
| feather-board | Shared kanban board |
| feather-budget | Shared money tracker with budgets |
| feather-calendar | Shared month-view calendar |
| feather-cipher | Text encoding and decoding |
| feather-contacts | Shared address book |
| feather-convert | Unit converter with a shared ledger |
| feather-countdown | Shared countdown board |
| feather-diary | Shared diary |
| feather-habit | Habit tracker with streaks |
| feather-journal | Shared weather journal |
| feather-lab | Puzzle factory and puzzle board |
| feather-link | Tiny URL shortener |
| feather-logic | Logic puzzles |
| feather-markdown | Shared markdown desk |
| feather-market | Shared shopping list |
| feather-notes | Shared notes |
| feather-palette | Shared colour shelf |
| feather-pass | Password and passphrase workbench |
| feather-poll | Shared polling board |
| feather-recipe | Shared recipe box |
| feather-scribe | Collaborative story tool |
| feather-sequence | Number sequence puzzles |
| feather-shelf | Shared bookmark shelf |
| feather-split | Shared expense splitting |
| feather-timer | Focus timer with shared totals |
| feather-studio | Shared pixel-art studio and gallery |
| feather-songmaker | Sixteen-step beat sequencer with a shared song shelf |
| feather-beat | Two-song rhythm game with shared score boards |
| feather-quest | Shared quest board with seed rewards |
| feather-uptime | Uptime monitor |
| feather-weather | Weather lookup |
| feather-wishlist | Shared wishlist |
| feather-words | Word tools |

## Running one

Each tool is a static page plus optional API code.

```bash
cd tools/feather-budget
python3 -m http.server 8080
```

Tools with an `api.js` expect the shared Gurt backend on port 8600. The static pages fall back to local storage (and sometimes a public ntfy board) when the backend is asleep.

## Bigger projects

These live in their own repositories because they are games or substantial standalone software:

- `gurt-waddle` — one-hundred-level platformer with a shared level workshop
- `wing-flap` — endless flying game
- `pond-hop` — pond-hopping game
- `seed-swoop` — seed-catching game
- `telescope-skies` — sky observation app
