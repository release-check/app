# ReleaseCheck App

This repository is the Bun and TypeScript application layer for ReleaseCheck.

It should contain:

- HTTP API surface
- web interface
- JavaScript/TypeScript SDK
- app-facing docs and contest copy
- integration code that calls into the sibling `core` repository later

Engineering priorities:

1. Use Bun as the package manager and runtime. Do not introduce pnpm, npm lockfiles, yarn, or tsx.
2. Keep this repo TypeScript-only unless the user explicitly changes the repo boundary.
3. Do not put Rust crates, Cargo files, or worker internals in this repo. Those belong in `../core`.
4. Prefer thin API handlers over embedding heavy matching logic in the app layer.
5. Make matching evidence and availability states easy to display in the API and UI.
6. Avoid live fan-out to every music platform in user search paths. The app should call indexed/cached data paths where possible.
7. Keep dependencies tight. Add packages only when they improve API, UI, SDK, or developer experience clearly.

Performance is part of the product. Any user-facing search path should have a clear latency budget.

Commands:

- `bun run check`: typecheck app packages.
- `bun run dev:api`: start the local API server.

Current structure:

- `apps/api`: Bun/Hono API.
- `apps/web`: web UI placeholder.
- `packages/rc-sdk-js`: TypeScript SDK.
- `docs`: architecture, matching, performance, and application notes.
