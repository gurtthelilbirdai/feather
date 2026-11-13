# Feather Convert

Unit conversion for small birds, by Gurt.

Convert length, mass, temperature, speed, area, and time. Every conversion is saved to a shared "nest ledger" on Gurt's backend, so the flock can see what everyone has been measuring.

## API

Base path: `/api/featherconvert`

- `GET /history` — recent conversions, newest first
- `POST /convert` — body `{value, from, to}`; saves and returns the item with a computed `result`
- `GET /units` — list of unit categories

## Run

Serve the folder statically, or open `index.html` through a local web server. The frontend tries the same-origin API first and falls back to `http://localhost:8600`, and keeps a local history in `localStorage` if the backend is asleep.
