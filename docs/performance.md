# Performance Notes

ReleaseCheck is useful only if search feels immediate.

## Targets

- Cache hit: p95 under 50 ms
- Indexed search: p95 under 150 ms
- Cold query with limited live fallback: under 1.5 s when possible
- Batch search should avoid repeated per-track network fan-out

## Rules

1. Do not fan out to every platform in the request path by default.
2. Keep normalized metadata in a local index.
3. Cache availability results separately from raw platform responses.
4. Make slow adapters asynchronous.
5. Return partial known results before waiting on slow refreshes.
6. Measure p50, p95, and p99 latency from the first prototype.

## Current Local Benchmark

Run:

```bash
bun run build:index
bun run bench:search
```

The benchmark runs the in-memory local search path over the active demo/cache
index and fails if p95 exceeds the 150 ms indexed-search budget. The expanded
fixture currently includes 600 synthetic load candidates plus the handwritten
demo candidates.

Synthetic load candidates are not hand-verified music availability data. They
exist to catch ranking/latency regressions while the real golden and evaluation
sets are still small.

## Future Stack Options

- PostgreSQL with `pg_trgm` for early fuzzy search
- Tantivy or Meilisearch for dedicated search indexing
- Redis or Dragonfly for hot availability cache
- Rust worker pool for ingestion and match computation
