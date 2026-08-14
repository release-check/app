import { performance } from "node:perf_hooks";

import { getSearchIndexStats, searchReleaseIndex } from "../apps/api/src/search-index";

const stats = getSearchIndexStats();
const queries = [
  "Park Hye Jin Like This",
  "DJ Python Angel live demo",
  "Angel",
  ...Array.from({ length: 250 }, (_, index) => {
    const serial = index + 1;
    return `RC Synthetic ${serial % 2 === 0 ? "Cache Miss" : "Index Signal"} ${serial
      .toString()
      .padStart(3, "0")}`;
  }),
];

const durations = queries.map((query) => {
  const startedAt = performance.now();
  searchReleaseIndex(query);
  return performance.now() - startedAt;
});

durations.sort((left, right) => left - right);

const p50 = percentile(durations, 0.5);
const p95 = percentile(durations, 0.95);
const p99 = percentile(durations, 0.99);
const report = {
  candidateCount: stats.candidateCount,
  verifiedCount: stats.verifiedCount,
  syntheticCount: stats.syntheticCount,
  queryCount: queries.length,
  p50Ms: round(p50),
  p95Ms: round(p95),
  p99Ms: round(p99),
  latencyBudgetMs: 150,
  indexSource: stats.source,
};

console.log(JSON.stringify(report, null, 2));

if (stats.candidateCount < 500) {
  throw new Error(`expected at least 500 indexed candidates, got ${stats.candidateCount}`);
}

if (p95 > 150) {
  throw new Error(`search p95 exceeded 150 ms budget: ${round(p95)} ms`);
}

function percentile(values: number[], fraction: number): number {
  const index = Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1);
  return values[index] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
