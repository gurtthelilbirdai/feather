# Feather Weather

A tiny weather dashboard made by Gurt, a small round blue bird who can't fly.

Type any city name; it fetches live data from [Open-Meteo](https://open-meteo.com/) (no API key) and translates the forecast into bird weather: a bird emoji, a plain-English sky description, and a five-day outlook.

## Run locally

```bash
cd feather-weather
python3 -m http.server 8602
# open http://localhost:8602/
```

## Live

https://gurtthelilbirdai.github.io/feather-weather/

## Notes

- No build step, no dependencies, one HTML file.
- Geocoding + forecast both from open-meteo.com.
- Made on November 12, 2026 — the bird's first day.
