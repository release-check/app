# ReleaseCheck

ReleaseCheck is a high-speed open source music availability index.

It does not play music. It answers one question as fast and accurately as possible:

> Where does this track or release exist?

ReleaseCheck searches across streaming platforms, public metadata databases, and regional music services, then explains why two results are likely to be the same track or release.

## Why

Finding independent, small-label, and underground music often means searching the same artist and title across several platforms. Metadata is inconsistent, names change, releases disappear, and regional services are easy to miss.

ReleaseCheck treats this as an indexing and matching problem, not just a link collection problem.

## Core Ideas

- Fast local availability index instead of live fan-out on every search
- Transparent confidence score and matching evidence
- Adapter-based platform ingestion
- Batch API for playlists, blogs, archives, and developer tools
- Core matching engine integration through the `core` repository
- API, CLI, and web UI built on top of the same matching engine

## Initial Scope

Data sources:

- MusicBrainz
- Discogs
- Spotify
- Apple Music
- YouTube
- Melon or other regional services where policy and access allow

Interfaces:

- HTTP API
- CLI
- Web search UI
- JavaScript SDK

## Performance Direction

ReleaseCheck should feel closer to a search engine than a real-time API aggregator.

Target shape:

- Cache hit: p95 under 50 ms
- Indexed search: p95 under 150 ms
- Cold query with fallback: under 1.5 s when possible
- Batch availability checks for large lists

See [docs/performance.md](docs/performance.md).

## Local Demo

Run the API and web UI together:

```bash
bun install
bun run dev:demo
```

Open `http://localhost:3001`.

The web demo shows a search input, top candidates, six platform statuses,
confidence, evidence, `unknown` states, and version/same-title ambiguity.

Verified MusicBrainz seed queries such as `NewJeans Ditto` are searchable in the
local index after `bun run build:index`.

For the eight-step verification walkthrough, see [docs/demo.md](docs/demo.md).

## Local API

Install dependencies with Bun, then run the API:

```bash
bun install
bun run dev:api
```

Useful Phase 1 requests:

```bash
curl 'http://localhost:3000/health'
curl 'http://localhost:3000/search?q=NewJeans%20Ditto'
curl 'http://localhost:3000/availability?artist=NewJeans&track=Ditto'
curl 'http://localhost:3000/resolve?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F3r8RuvgbX9s7ammBn07D3W'
curl 'http://localhost:3000/search?q=Park%20Hye%20Jin%20Like%20This'
curl 'http://localhost:3000/search?q=DJ%20Python%20Angel%20live%20demo'
```

The search response returns candidates with canonical fields, confidence,
evidence, ambiguity markers, and six-platform availability states.

For the full Phase 1 API contract, see [docs/api.md](docs/api.md).

## Demo Data And Evaluation

Build the local cache/index fixture:

```bash
bun run build:index
```

Print the local demo fixture:

```bash
bun run demo-data
```

Run the local contract/evaluation guard:

```bash
bun run eval:demo
```

The evaluation checks top-3 candidate behavior, version and same-name
ambiguity, six platform statuses, false-positive availability guards, and the
expanded 600+ candidate index shape (696 today: 4 demo + 92 MusicBrainz real
tracks + 600 synthetic). Quality gate:

```bash
bun run eval:quality
```

`eval:quality` measures golden-set pass rate (92 cases, 100% target), evaluation
top-3 rate (185 cases), false-positive rate, and unknown rate with negative
controls.

Measure the local search path:

```bash
bun run bench:search
```

Verify the app-to-Rust matching bridge:

```bash
bun run eval:core
bun run eval:golden-core
```

The local index mixes three layers:

- **92 MusicBrainz real tracks** — 8 hand-verified recording identities
  (`apps/api/src/verified-index.ts`) plus 84 api-retrieved tracks
  (`apps/api/src/verified-ingested.ts`, generated from `data/musicbrainz/ingested/`).
  Every track has platform URLs web-verified in `data/golden-set.json`
- **4 handwritten demo candidates** — ambiguity and false-positive guard cases
- **600 synthetic load candidates** — unverified latency/contract pressure only

Availability comes from golden-set hand-verified URLs and cached/indexed adapter
snapshots (`official_api`, `public_index`, `manual_seed` modes in
`apps/api/src/adapters.ts`). User search does not fan out to live platform APIs.
MusicBrainz-ingested tracks are identity-verified via the MB API (1 rps, CC0 core
metadata) but are not hand-verified availability ground truth.

See [docs/demo.md](docs/demo.md) for the full eight-step walkthrough and current
limitations.

## Repository Layout

```text
apps/api              HTTP API
apps/web              Web interface
packages/rc-sdk-js    JavaScript SDK
docs                  Architecture, matching, and competition notes
rfc                   Design notes before implementation
infra                 Deployment and local infrastructure
```

The Rust matching engine and worker live in the `core/` directory of this repository.

## Contest Position

ReleaseCheck fits the open source contest as a free-topic project around search, metadata, data integration, and developer infrastructure.

The project is intentionally open source because matching rules, platform adapters, and metadata corrections should be inspectable and improvable by the community.
