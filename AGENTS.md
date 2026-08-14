# ReleaseCheck

Single repository for the ReleaseCheck product. Bun/TypeScript application layer and Rust matching core live together.

## Repository layout

- `apps/api`: Bun/Hono HTTP API.
- `apps/web`: web demo UI.
- `packages/rc-sdk-js`: TypeScript SDK.
- `core/`: Rust workspace — `crates/rc-core` (matching engine), `crates/rc-worker` (CLI/JSON boundary).
- `docs`: architecture, matching, performance, and application notes.
- `data`: golden set, evaluation set, MusicBrainz seeds, provenance.
- `scripts`, `verification`, `tests`: local gates and evaluation tooling.

## Engineering priorities

1. Use Bun as the package manager and runtime. Do not introduce pnpm, npm lockfiles, yarn, or tsx.
2. Keep the Rust code inside `core/` and the TypeScript code outside it. Do not mix them in one package or crate.
3. Do not embed Rust matching logic in the app layer. The boundary is the `rc-worker match-json` subprocess (see `apps/api/src/core-bridge.ts`).
4. Prefer thin API handlers over embedding heavy matching logic in the app layer.
5. Make matching evidence and availability states easy to display in the API and UI.
6. Avoid live fan-out to every music platform in user search paths. The app should call indexed/cached data paths where possible.
7. Keep dependencies tight. Add packages only when they improve API, UI, SDK, or developer experience clearly.
8. Do not redistribute MusicBrainz metadata beyond CC0 core metadata; respect the documented rate limits and User-Agent requirements.

Performance is part of the product. Any user-facing search path should have a clear latency budget.

## Commands

- `bun run check`: typecheck app packages.
- `bun run dev:api`: start the local API server.
- `bun run dev:demo`: run API + web demo together.
- `cd core && cargo test --workspace`: Rust core tests.
- `cd core && cargo run -p rc-worker -- match-json`: manual Rust boundary check.

## Verification

- `app`: `bun run check`, `bun test`, `bun run eval:demo`, `bun run validate:provenance`, `bun run eval:verified`.
- `core`: `cargo test --workspace`.
- Changes touching both sides run both.
