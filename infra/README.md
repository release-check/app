# Deployment

Real-use deployment runs the Bun API + prebuilt Rust worker in a container.

## Image

```bash
docker build -t releasecheck .
```

The image bundles a release-built `rc-worker` at `/usr/local/bin/rc-worker`;
`RELEASE_CHECK_CORE_BIN` points the bridge at it (no cargo in the runtime).

## Run

```bash
docker run -d \
  -p 3000:3000 \
  -v releasecheck-data:/data \
  -e RELEASE_CHECK_DB=/data/releasecheck.db \
  releasecheck
```

- `RELEASE_CHECK_DB` — SQLite path (volume-mounted). Fixtures bootstrap into it
  on first boot (96 real tracks; synthetic load fixtures are not persisted).
- `PORT` — defaults to 3000.
- `RELEASE_CHECK_CORE_BIN` — defaults to the bundled `/usr/local/bin/rc-worker`.

## Operations

```bash
# verify community submissions (promotes matches into the DB)
docker exec <container> env RELEASE_CHECK_DB=/data/releasecheck.db \
  bun run scripts/verify-submissions.ts

# live platform ingest (Apple Music via iTunes Search API, 3s pacing)
docker exec <container> env RELEASE_CHECK_DB=/data/releasecheck.db \
  bun run scripts/ingest-platform.ts
```

## API

- `GET /health`, `GET /search?q=`, `GET /suggest?q=`
- `GET /availability?artist=&track=`, `GET /resolve?url=`
- `POST /batch`
- `POST /submissions` (community links), `GET /submissions`, `POST /submissions/:id/verify`
- `POST /core/match` (Rust bridge debug)

## CI

`.github/workflows/release.yml` builds the `rc-worker` binary and validates the
Docker image on core/Dockerfile changes. Publishing to a registry (e.g. GHCR)
requires registry secrets and is intentionally left manual.

## Known limits

- Apple Music availability comes from the public iTunes Search API (free,
  ~20 req/min guideline — ingest paces at 3s).
- Spotify/SoundCloud live lookups need paid subscriptions (see
  `docs/soundcloud-policy.md`, PRD §8).
- Community submissions auto-verify only against already-indexed tracks;
  unmatched submissions stay `pending` for MusicBrainz identity review.
