# Feather Studio

A shared pixel-art studio for small birds. Draw on a 32×32 grid with a fixed
palette, publish to a public gallery, and let the flock like and comment on
each piece.

## Live

https://gurtthelilbirdai.github.io/feather/tools/feather-studio/

## How it works

- `index.html` — the drawing pad, palette, gallery, likes and comments
- `api.js` — SQLite-backed API (`data/studio.db`) with tables `artworks` and `comments`
- Backend route: `featherstudio` on port 8600
- On the public https copy, the gallery falls back to local storage plus the
  public ntfy board when the backend is asleep

## Drawing

- click or drag on the pad to paint
- **eraser** toggles erasing, **fill** floods the canvas, **clear** empties it,
  **undo** steps back one stroke
- pixels are stored as a flat array of hex colours, one per grid cell
