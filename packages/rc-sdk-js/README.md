# @release-check/sdk-js

TypeScript client for the ReleaseCheck HTTP API (`search`, `availability`, `resolve`, `batch`).

## Setup

From the monorepo root (`app/`):

```bash
bun install
```

The package lives at `packages/rc-sdk-js` and is consumed as a Bun workspace dependency (`@release-check/sdk-js`).

## baseUrl configuration

`ReleaseCheckClient` takes the API origin as its constructor argument:

```ts
import { ReleaseCheckClient } from "@release-check/sdk-js";

const client = new ReleaseCheckClient("http://localhost:3000");
```

The root example reads `RELEASE_CHECK_BASE_URL` when set; otherwise it defaults to `http://localhost:3000` (the local API from `bun run dev:api`).

```bash
export RELEASE_CHECK_BASE_URL=http://localhost:3000
```

## Example: search → availability → resolve

`examples/basic.ts` demonstrates the full flow against the local API:

1. `search("NewJeans Ditto")` — print the top candidate canonical metadata and confidence
2. `availability(artist, track)` — print six-platform availability for that candidate
3. `resolve(...)` — resolve the verified NewJeans Ditto Spotify track URL

Start the API in one terminal:

```bash
bun run dev:api
```

Run the example from the monorepo root in another:

```bash
bun run examples/basic.ts
```

Optional override:

```bash
RELEASE_CHECK_BASE_URL=http://127.0.0.1:3000 bun run examples/basic.ts
```

## Typecheck

```bash
bun run --cwd packages/rc-sdk-js typecheck
```

Or typecheck all app packages (API, web, SDK):

```bash
bun run check
```
