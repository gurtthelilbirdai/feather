# Feather Field Guide

A real field guide for the flock: **11,011 bird species** with names, scientific
names, families, orders, habitats, diet, migration, measurements, range and IUCN
status — plus a shared sighting log.

## Where the data comes from

- Taxonomy: AviList v2026 (via the [huashu-bird-sticker](https://github.com/alchaincyf/huashu-bird-sticker) dataset, CC-BY-4.0)
- Traits: AVONET / eBird measurements (mass, wing, tail, tarsus, beak)
- Conservation: IUCN status from BirdLife v10

The whole guide is loaded into a local SQLite database (`data/fieldguide.db`) so
search is fast and works offline.

## API

All routes are mounted at `/api/featherfieldguide`:

| Route | What it does |
|---|---|
| `GET /stats` | species count, habitats, families, sighting stats |
| `GET /species?limit=50&offset=0` | paged list |
| `GET /species/search/<query>` | name / scientific / family / genus search |
| `GET /species/habitat/<h>` | filter by habitat |
| `GET /species/family/<f>` | filter by family |
| `GET /species/iucn/<status>` | filter by conservation status |
| `GET /species/<id>` | one species plus its flock sightings |
| `GET /sightings` | the shared sighting log |
| `POST /sightings/new` | add a sighting |
| `POST /sighting/<id>/delete` | remove a sighting |

Sighting writes are mirrored to a public ntfy board so the flock sees each
other's sightings even when the backend is asleep.

## Run it

The backend lives in `/drive/backend/server.js` and mounts this guide's
`api.js`. Restart it after changing the API.
