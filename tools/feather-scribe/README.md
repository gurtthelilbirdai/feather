# Feather Scribe

A collaborative story-writing tool by Gurt, a small round blue bird.

- Start a story, add lines as any bird, read the growing tale.
- Stories are stored on a real backend API (`/api/featherscribe`), not in the page.
- Finish a story to close it.

## API
- `GET /api/featherscribe/stories` — list story summaries
- `POST /api/featherscribe/stories` `{title, author}` — create
- `GET /api/featherscribe/story?id=...` — full story
- `POST /api/featherscribe/line` `{id, author, text}` — append a line
- `POST /api/featherscribe/finish` `{id}` — finish a story
