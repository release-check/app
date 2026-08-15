# Benchmark Report

ReleaseCheck tracks two separate latency surfaces:

1. **Core matching** (`rc-core::match_candidates`) — pure normalize/score/decide work in Rust.
2. **Index search** (`searchReleaseIndex`) — in-memory demo/cache index lookup in the API layer.

These budgets are intentionally separate. App HTTP overhead, serialization, and adapter fan-out are not included in the core matching gate.

## Targets

| Surface | Dataset | Queries | Budget |
|---|---|---|---|
| Core matching | ~600 synthetic `ReleaseCandidate` rows | 1,000 `SourceTrack` queries | **p95 ≤ 10 ms** |
| Index search | active demo/cache index (≥500 candidates) | 253 local benchmark queries | **p95 ≤ 150 ms** |

Core matching is the hard gate for ranking correctness work. Index search covers the current TypeScript search path used by `bench:search`.

## How to run

### Core matching (Rust / Criterion)

```bash
cd core
cargo bench --bench match_bench
```

`match_bench` warms up, measures per-query latency for 1,000 queries against 600 synthetic candidates, prints `p50` / `p95` / `p99`, and **fails the bench** when core `p95` exceeds **10 ms**.

`cargo check --benches` is the lightweight compile gate used during development.

### Index search (TypeScript)

```bash
bun run build:index   # optional: populate data/cache/demo-index.json
bun run bench:search  # regression gate (150 ms p95)
bun run scripts/bench-report.ts  # refresh the auto-generated section below
```

## Failure modes

- **Core bench panic**: `match_bench` aborts with `core match p95 … exceeds 10.0 ms budget` when the Rust matching path regresses.
- **Index regression gate**: `scripts/bench-search.ts` throws when indexed-search `p95` exceeds 150 ms or the dataset has fewer than 500 candidates.
- **Manual review**: if CI skips `cargo bench` for cost reasons, compare the latest auto-generated report against the budgets above before merging performance-sensitive changes.

## Machine context

Reports record:

- `machine.arch`: output of `uname -m`
- `machine.cpus`: `os.cpus()` model names (deduplicated)

Use the same machine class when comparing numbers across runs.

<!-- BENCH_REPORT:auto:start -->

_Last updated: 2026-08-14T14:33:21.457Z_

## Latest index-search measurement

| Field | Value |
|---|---|
| schema_version | `releasecheck.verification-report.v1` |
| surface | `index_search` |
| dataset_size | 609 |
| query_count | 253 |
| mode | `cache` |
| p50_ms | 0.454 |
| p95_ms | 0.535 |
| p99_ms | 0.605 |
| latency_budget_ms | 150 |
| machine.arch | `arm64` |
| machine.cpus | `Apple M5 Pro` |

### Raw JSON

```json
{
  "schema_version": "releasecheck.verification-report.v1",
  "surface": "index_search",
  "generated_at": "2026-08-14T14:33:21.457Z",
  "dataset_size": 609,
  "query_count": 253,
  "mode": "cache",
  "p50_ms": 0.454,
  "p95_ms": 0.535,
  "p99_ms": 0.605,
  "latency_budget_ms": 150,
  "machine": {
    "arch": "arm64",
    "cpus": [
      "Apple M5 Pro"
    ]
  },
  "index": {
    "handwritten_count": 9,
    "synthetic_count": 600,
    "verified_count": 9,
    "messy_case_count": 203
  }
}
```

<!-- BENCH_REPORT:auto:end -->
