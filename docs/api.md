# API Contract

Phase 1 exposes a local demo-backed API contract. The API does not call live
music platforms in the request path.

## Run

```bash
bun run dev:api
```

The API listens on `http://localhost:3000` by default.

To run the API together with the web demo:

```bash
bun run dev:demo
```

## Endpoints

### `GET /health`

Returns service status.

```json
{
  "ok": true,
  "service": "release-check-api",
  "index": "demo"
}
```

### `GET /search?q=`

Returns ranked candidates, not a single forced truth.

```bash
curl 'http://localhost:3000/search?q=DJ%20Python%20Angel'
```

Each candidate includes:

- canonical artist, title, release, duration, and ISRC when known
- `confidence`
- `ambiguity` markers such as `same-title`, `live`, or `demo`
- matching `evidence`
- six-platform `availability`

### `GET /availability?artist=&track=`

Returns the best exact demo-index candidate and its platform availability map.

```bash
curl 'http://localhost:3000/availability?artist=Park%20Hye%20Jin&track=Like%20This'
```

### `GET /resolve?url=`

Resolves a known demo-index platform URL to a candidate when possible.

```bash
curl 'http://localhost:3000/resolve?url=https%3A%2F%2Fopen.spotify.com%2Fsearch%2FPark%2520Hye%2520Jin%2520Like%2520This'
```

### `POST /batch`

Checks multiple query, artist/track, or URL inputs.

```bash
curl -X POST 'http://localhost:3000/batch' \
  -H 'content-type: application/json' \
  -d '{"items":[{"q":"Angel"},{"artist":"Park Hye Jin","track":"Like This"}]}'
```

## Availability States

Every candidate includes these six platform keys:

- `spotify`
- `youtube_music`
- `apple_music`
- `soundcloud`
- `bandcamp`
- `melon`

Each platform entry uses one of:

- `available`
- `missing`
- `unknown`
- `region_locked`
- `removed`
- `duplicate_candidate`

`unknown` is a real state. It means the demo index does not have enough
information to claim `available` or `missing`.

## Demo Commands

Print the local demo fixture:

```bash
bun run demo-data
```

Run the local Phase 1 evaluation guard:

```bash
bun run eval:demo
```

The evaluation checks:

- exact/original query has the expected candidate in the top 3
- same-title ambiguity returns multiple candidates
- live/demo ambiguity is visible
- every candidate has all six platform statuses
- uncertain platform slots are not marked as false-positive `available`

`eval:demo` reads `data/evaluation-set.json`. `demo-data` also includes
`data/golden-set.json`, so later generated workspace fixtures can replace the
local demo files without changing the command shape.

## Current Limitations

- Demo data is hand-written and local.
- Search ranking is a small fixture ranker, not the final matching engine.
- No live fan-out to Spotify, YouTube Music, Apple Music, SoundCloud, Bandcamp,
  or Melon happens on user requests.
- The Rust matching engine and ingestion worker belong in the sibling `core`
  repository.
