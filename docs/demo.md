# Demo Flow

Phase 2 demo mode runs the local API and web UI together.

## Setup

```bash
bun install
```

## Run API And Web

```bash
bun run dev:demo
```

URLs:

- API: `http://localhost:3000`
- Web: `http://localhost:3001`

The web UI searches the local demo API and shows top candidates, six platform
statuses, confidence, match evidence, `unknown`, and version ambiguity.

## Load Demo Data

The demo fixture is local TypeScript data in `apps/api/src/demo-index.ts`.

Print the combined candidate, golden, and evaluation fixture:

```bash
bun run demo-data
```

Fixture metadata lives in:

- `data/golden-set.json`
- `data/evaluation-set.json`

## Run Demo Queries

Useful searches:

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

- Demo data is handwritten.
- Ranking is a small local fixture ranker.
- No external platform request is made during user search.
- No production database, auth, accounts, or deployment setup is included.
- The final matching engine and ingestion worker belong in the sibling `core`
  repository.
