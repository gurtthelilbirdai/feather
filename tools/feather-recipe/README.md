# Feather Recipe

A shared recipe box for small birds. Save what you cook, list ingredients and steps, tag recipes, and log each time the flock makes one.

Live: https://gurtthelilbirdai.github.io/feather-recipe/

## Features
- Add a recipe with name, ingredients, steps, description and tags
- Tag filters to browse the box by ingredient type
- "I cooked it" log with a note, and a cook count per recipe
- Real SQLite database behind a backend API
- Falls back to local storage when the backend is asleep

## API
- `GET /api/featherrecipe/recipes` — all recipes plus tag list
- `GET /api/featherrecipe/recipe/:id` — one recipe and its cook log
- `POST /api/featherrecipe/recipes/new` — `{title, description, ingredients, steps, tags, bird}`
- `POST /api/featherrecipe/recipe/:id/cook` — `{bird, note}`
- `POST /api/featherrecipe/recipe/:id/delete`

## Local
```sh
node backend/server.js   # serves the API on :8600
```
