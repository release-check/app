# Demo Flow

Phase 2 demo mode runs the local API and web UI together. The index combines four
handwritten demo candidates, five MusicBrainz hand-verified seeds, and 600 synthetic
load fixtures built by `bun run build:index`.

## Run API And Web

```bash
bun install
bun run dev:demo
```

URLs:

- API: `http://localhost:3000`
- Web: `http://localhost:3001`

The web UI searches the local demo API and shows top candidates, six platform
statuses, confidence, match evidence, `unknown`, and version ambiguity.

For API-only spot checks, start the API briefly in another terminal:

```bash
bun run dev:api
```

## Eight-Step Verification Walkthrough

Run these steps against the current tree to confirm the documented demo contract.
Recorded outputs below were captured on 2026-08-14 after `bun run build:index`.

### 1. Setup

```bash
bun install
bun run check
```

`bun run check` runs the workspace TypeScript checks for `apps/api`, `apps/web`, and
`packages/rc-sdk-js`.

### 2. Data load

```bash
bun run build:index
bun run demo-data
```

`build:index` writes `data/cache/demo-index.json` and prints index shape:

```json
{
  "candidateCount": 609,
  "handwrittenCount": 9,
  "syntheticCount": 600,
  "verifiedCount": 9,
  "messyCaseCount": 203
}
```

`handwrittenCount` is four demo fixtures plus five MusicBrainz verified seeds.
`syntheticCount` is the unverified load fixture used for latency and contract pressure.
`demo-data` prints `indexStats`, handwritten candidates, a synthetic preview, and the
golden/evaluation fixture metadata from `data/golden-set.json` and
`data/evaluation-set.json`.

### 3. Search (verified candidate)

With `bun run dev:api` running:

```bash
curl 'http://localhost:3000/health'
curl 'http://localhost:3000/search?q=NewJeans%20Ditto'
```

`/health` returns `ok: true`, `index: "demo-cache"`, and the active index stats.

`/search` returns `verified-newjeans-ditto` as the top candidate with
`sample.origin: "verified_musicbrainz"` and confidence `0.97`.

Other MusicBrainz seed queries that resolve in the current index:

- `Björk Jóga`
- `Yellow Magic Orchestra Rydeen`
- `Charli XCX Vroom Vroom`
- `Mariya Takeuchi Plastic Love`

Handwritten ambiguity demos still work:

- `Park Hye Jin Like This`
- `Angel`
- `DJ Python Angel live demo`

### 4. Availability

```bash
curl 'http://localhost:3000/availability?artist=NewJeans&track=Ditto'
```

Returns the same `verified-newjeans-ditto` candidate plus a flattened six-platform
`availability` map.

### 5. Evidence

Inspect the `evidence` array on the search or availability response. For
`NewJeans Ditto` the API returns four rows:

- `artist` — exact artist credit match
- `title` — exact title match
- `duration` — duration matches MusicBrainz recording
- `musicbrainz` — recording `adf44a12-e5f4-48aa-9029-b9ef4b5f1d6d` hand-verified

### 6. Unknown and region-locked states

Platform slots without confirmed indexed evidence stay `unknown` or `missing` instead
of being guessed as `available`.

For `NewJeans Ditto`:

- `soundcloud` → `unknown` (`no official SoundCloud upload confirmed`)
- `bandcamp` → `missing` (`not present on Bandcamp`)
- `spotify`, `youtube_music`, `apple_music`, `melon` → `available` with indexed URLs

The handwritten `DJ Python Angel live demo` query still surfaces `live` ambiguity and
keeps uncertain platform slots out of false-positive `available` states.

Optional URL resolve check:

```bash
curl 'http://localhost:3000/resolve?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F3r8RuvgbX9s7ammBn07D3W'
```

Returns the same verified Ditto candidate when the Spotify track URL is indexed.

### 7. Benchmark

```bash
bun run bench:search
```

Example output:

```json
{
  "candidateCount": 609,
  "verifiedCount": 9,
  "syntheticCount": 600,
  "queryCount": 253,
  "p50Ms": 0.468,
  "p95Ms": 0.58,
  "p99Ms": 0.792,
  "latencyBudgetMs": 150,
  "indexSource": "cache"
}
```

The benchmark exercises the in-process search path against the cached index and
asserts `candidateCount >= 500` and `p95Ms <= 150`.

### 8. Limitations

See [Known Limitations](#known-limitations) below. Re-run this walkthrough after index
or adapter policy changes.

## Load Demo Data

The handwritten fixture lives in `apps/api/src/demo-index.ts`. Verified MusicBrainz
seeds live in `apps/api/src/verified-index.ts` (sourced from
`data/musicbrainz/positive-recording-seeds.v1.json`). Synthetic load fixtures are
generated in `apps/api/src/synthetic-fixtures.ts` and merged by `scripts/build-index.ts`.

Print the combined candidate, golden, and evaluation fixture:

```bash
bun run demo-data
```

Fixture metadata lives in:

- `data/golden-set.json`
- `data/evaluation-set.json`

## Run Demo Queries

Useful searches:

- `NewJeans Ditto` — verified MusicBrainz seed (korea scene)
- `Park Hye Jin Like This`
- `Angel`
- `DJ Python Angel live demo`

The `Angel` query shows same-title ambiguity. The live demo query shows version
ambiguity and avoids marking uncertain platform slots as available.

## Explain Output

Each candidate includes:

- canonical artist, title, release, duration, and ISRC when known
- confidence score
- ambiguity markers
- evidence rows with field-level scores and notes
- six platform availability entries
- optional `sample` metadata (`origin`, `scene`, `verified`, `messyCase`)

`unknown` means the index does not have enough evidence to claim `available` or
`missing`. It is intentionally visible in the API and web UI.

## Verify Demo Contract

```bash
bun run check
bun run eval:demo
```

`eval:demo` reads `data/evaluation-set.json` and checks top-3 behavior,
ambiguity markers, six platform keys, and false-positive availability guards.

## Known Limitations

- **Handwritten and verified data only cover a small slice of the catalog.** Five
  MusicBrainz recording identities are hand-verified (CC0 core metadata plus
  seed-writer platform checks on 2026-08-14). Four additional handwritten demo
  candidates cover ambiguity cases. Everything else in search ranking is local
  fixture data, not live catalog truth.
- **600 synthetic load candidates are unverified.** They exist to stress latency,
  six-platform shape, and `unknown`/`region_locked` distribution. They must not be
  treated as real availability results.
- **Manual verification boundary.** Availability labels on verified seeds were checked
  manually against public platform pages at seed-write time. The API does not re-check
  platforms on user search, so removals, region changes, or catalog drift will not be
  detected automatically.
- **Adapter modes are policy placeholders, not live fan-out.** Indexed availability is
  shaped by per-platform adapter policy in `apps/api/src/adapters.ts`:
  - `official_api` — Spotify, Apple Music (cached/indexed only; `liveLookupAllowed: false`)
  - `public_index` — YouTube Music, SoundCloud (indexed public results only)
  - `manual_seed` — Bandcamp, Melon (manual/public seed until policy-aware ingestion exists)
  - `not_configured` — reserved for platforms without an active adapter path
- **Ranking is still a small local fixture ranker**, not the final Rust core ranking
  path for every query.
- **No external platform request is made during user search.**
- **No production database, auth, accounts, or deployment setup is included.**
- The Rust matching engine and ingestion worker live in the sibling `core` repository
  and are exposed today through `/core/match` and `bun run eval:core`, not the public
  `/search` rerank path.
