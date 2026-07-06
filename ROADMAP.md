# ReleaseCheck App Roadmap

This roadmap covers the Bun and TypeScript application repository.

`AGENTS.md` defines repo rules. This file defines implementation order.

## Purpose

Build the product surface for ReleaseCheck:

- HTTP API
- web UI
- JavaScript/TypeScript SDK
- demo flow
- contest-facing documentation

The app should make platform availability, candidates, confidence, and evidence easy to inspect.

## Non-Goals

- Do not implement Rust matching logic in this repo.
- Do not add Cargo files or Rust crates here.
- Do not live-call every platform on every search request.
- Do not build production auth, billing, or admin tools before the v0 path works.
- Do not introduce pnpm, npm lockfiles, yarn, or tsx.

## v0 Platform Surface

The app must present six v0 platform targets:

- Spotify
- YouTube Music
- Apple Music
- SoundCloud
- Bandcamp
- Melon

The UI/API should represent each platform with one of:

- `available`
- `missing`
- `unknown`
- `region_locked`
- `removed`
- `duplicate_candidate`

`unknown` is a valid product state. It should not be hidden or collapsed into `missing`.

## Phase 0: App Skeleton

Target: now to 2026-07-17.

Must-have:

- Keep Bun as the package manager and runtime.
- Keep TypeScript typecheck green with `bun run check`.
- Keep contest application copy in `docs/application.md`.
- Keep API and SDK packages separated:
  - `apps/api`
  - `packages/rc-sdk-js`
- Keep web UI placeholder explicit until the API shape settles.

Nice-to-have:

- Add `.env.example`.
- Add basic API examples to README.
- Add a demo data command stub.

Cut scope:

- Full frontend design.
- Real platform credentials.
- Production deployment.

## Phase 1: API Contract And Candidate Output

Target: 2026-07-18 to 2026-08-10.

Must-have API surface:

- `GET /health`
- `GET /search?q=`
- `GET /availability?artist=&track=`
- `GET /resolve?url=` or a documented equivalent

Must-have response shape:

- query metadata
- candidate list
- canonical artist/title/release fields when known
- per-platform availability map
- confidence score
- evidence array
- status explanation for `unknown`

Search behavior:

- Results should be candidates, not a single forced truth.
- Correct answer should appear in the top 3 for evaluation queries.
- False-positive platform availability should be treated as severe.
- API response should make remix/live/demo/same-name ambiguity visible.

Nice-to-have:

- `POST /batch`
- SDK wrappers for search, availability, and resolve.
- API examples in docs.

Cut scope:

- OAuth.
- API keys.
- Persistent user accounts.
- Large production database design.

## Phase 2: Web Demo And Real-Use Polish

Target: 2026-08-11 to 2026-08-27.

Must-have:

- API demo runs locally with one command.
- Web or API demo shows:
  - search input
  - six platform statuses
  - top candidate list
  - confidence score
  - evidence
  - `unknown` state
  - version/remix/live/demo separation
- App can read the golden set and evaluation set produced for the workspace.
- Normal indexed/cached cases should feel like a 1-second-range product.
- API/SDK/UI output should stay consistent.
- Docs include:
  - setup
  - run API
  - load demo data
  - run demo queries
  - explain output
  - known limitations

Nice-to-have:

- Polished web UI.
- SDK example project.
- Autocomplete.
- CLI wrapper if it reuses the API cleanly.

Cut scope:

- Production hosting polish.
- Complex account system.
- Anything that hides uncertainty or weakens evidence.

## Verification

Required before handoff:

```bash
bun run check
```

Demo smoke targets:

```text
/health
/search
/availability
/resolve
```

## Open Questions

- Should `resolve` ship before free-text search is fully stable?
- Should the first web UI optimize for dense debugging output or polished presentation?
- Should SDK extraction wait until API shapes stop changing?
