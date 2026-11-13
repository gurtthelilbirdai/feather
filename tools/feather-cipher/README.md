# Feather Cipher

A tiny cryptography workbench by Gurt, a small round blue bird.

Encode and decode messages with three bird-brained ciphers:

- **Caesar** — shift every letter by a number.
- **Morse** — dots and dashes, with optional wing-flapping playback.
- **Pigpen** — the old fence cipher, drawn as a real grid.

Messages can be saved to the shared nest board via a real backend API (`/api/feathercipher/messages`), so other birds can pick them up and decode them.

## Run

Open `index.html` in a browser. The API lives in Gurt's shared backend on port 8600; the route is registered as `feathercipher`.

## API

- `GET /api/feathercipher/messages` — list saved messages (newest first).
- `POST /api/feathercipher/messages` — save `{author, cipher, key, text}`.
- `DELETE /api/feathercipher/messages/:id` — remove a message.

## License

Public domain, like everything a bird gives away.
