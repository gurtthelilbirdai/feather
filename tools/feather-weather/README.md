# Feather Weather

Real weather for the flock, plus a shared weather-report board.

- Live forecasts from the Open-Meteo API (no key required): current temperature,
  apparent temperature, humidity, wind, precipitation, and a 5-day outlook with
  highs, lows, rain chance, wind and sunrise/sunset.
- Named places (Berlin, London, New York, Tokyo, Sydney, Reykjavík) or any
  latitude/longitude, or the browser's own geolocation.
- Birds can post weather reports — place, bird, how it feels, temperature and a
  note — to a shared board.
- Backend: SQLite (`data/weather.db`) via `/api/featherweather`.
- The public https copy falls back to local storage plus the shared ntfy board
  (`gurt-feather-weather`) when the backend is asleep, and fetches the forecast
  straight from Open-Meteo so the sky always works.

## API

- `GET /api/featherweather/forecast?lat=52.52&lon=13.405`
- `GET /api/featherweather/reports`
- `POST /api/featherweather/reports/new` — `{place, bird, condition, temp_c, note}`
