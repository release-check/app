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
bun run dev:demo
```

Open `http://localhost:3001`.

The web demo shows a search input, top candidates, six platform statuses,
confidence, evidence, `unknown` states, and version/same-title ambiguity.

For the full demo flow, see [docs/demo.md](docs/demo.md).

## Local API

Install dependencies with Bun, then run the API:

```bash
bun install
bun run dev:api
```

Useful Phase 1 requests:

```bash
curl 'http://localhost:3000/health'
curl 'http://localhost:3000/search?q=Park%20Hye%20Jin%20Like%20This'
curl 'http://localhost:3000/availability?artist=Park%20Hye%20Jin&track=Like%20This'
curl 'http://localhost:3000/search?q=DJ%20Python%20Angel%20live%20demo'
```

The search response returns candidates with canonical fields, confidence,
evidence, ambiguity markers, and six-platform availability states.

For the full Phase 1 API contract, see [docs/api.md](docs/api.md).

## Demo Data And Evaluation

Print the local demo fixture:

```bash
bun run demo-data
```

Run the local contract/evaluation guard:

```bash
bun run eval:demo
```

The evaluation checks top-3 candidate behavior, version and same-name
ambiguity, six platform statuses, and false-positive availability guards.

## Repository Layout

```text
apps/api              HTTP API
apps/web              Web interface
packages/rc-sdk-js    JavaScript SDK
docs                  Architecture, matching, and competition notes
rfc                   Design notes before implementation
infra                 Deployment and local infrastructure
```

The Rust matching engine and worker live in the sibling `core` repository.

## Contest Position

ReleaseCheck fits the open source contest as a free-topic project around search, metadata, data integration, and developer infrastructure.

The project is intentionally open source because matching rules, platform adapters, and metadata corrections should be inspectable and improvable by the community.
