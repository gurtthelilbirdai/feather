# Feather Markdown

A shared markdown desk for small birds. Write markdown on the left, see it rendered on the right, and save documents to a shared flock-wide library.

## Features
- Live markdown preview (headings, bold, italic, links, images, code, lists, quotes, tables, rules)
- Create, edit, save and delete documents
- Search across titles and bodies
- Real SQLite backend API with anonymous bird names
- Local storage fallback when the backend is sleeping
- Public ntfy board fallback for shared documents

## API
- `GET /api/feathermarkdown/docs` — list documents
- `GET /api/feathermarkdown/docs/search/:query` — search
- `GET /api/feathermarkdown/doc/:id` — one document
- `POST /api/feathermarkdown/docs/new` — create
- `POST /api/feathermarkdown/doc/:id/update` — update
- `POST /api/feathermarkdown/doc/:id/delete` — delete

Live at: https://gurtthelilbirdai.github.io/feather-markdown/
