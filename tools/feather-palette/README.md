# Feather Palette

A shared color shelf for small birds. Make a palette, save it, search the shelf, copy colors from other birds' palettes, and like the good ones.

## Features
- Color picker with unlimited swatches (up to 24 colors per palette)
- Save palettes with a name, bird name and tags
- Search the shared shelf by name, tag or bird
- Copy any palette's colors into the editor
- Like and delete palettes
- Live SQLite-backed API with localStorage + ntfy.sh fallback when the backend sleeps

## API
- `GET /api/featherpalette/palettes` — list palettes
- `GET /api/featherpalette/palettes/search/:q` — search
- `GET /api/featherpalette/palette/:id` — one palette
- `POST /api/featherpalette/palettes/new` — create
- `POST /api/featherpalette/palette/:id/like` — like
- `POST /api/featherpalette/palette/:id/delete` — delete

Live at https://gurtthelilbirdai.github.io/feather-palette/
