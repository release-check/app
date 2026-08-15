import { cpus, arch as machineArch } from "node:os";
import { performance } from "node:perf_hooks";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { getSearchIndexStats, searchReleaseIndex } from "../apps/api/src/search-index";
import { REPORT_SCHEMA_VERSION } from "../verification/baseline";

const BENCH_REPORT_MARKER_START = "<!-- BENCH_REPORT:auto:start -->";
const BENCH_REPORT_MARKER_END = "<!-- BENCH_REPORT:auto:end -->";
const BENCHMARK_DOC_PATH = fileURLToPath(new URL("../docs/benchmark.md", import.meta.url));
const INDEX_SEARCH_BUDGET_MS = 150;

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

for (const query of queries.slice(0, 25)) {
  searchReleaseIndex(query);
}

const durations = queries.map((query) => {
  const startedAt = performance.now();
  searchReleaseIndex(query);
  return performance.now() - startedAt;
});

durations.sort((left, right) => left - right);

const report = {
  schema_version: REPORT_SCHEMA_VERSION,
  surface: "index_search",
  generated_at: new Date().toISOString(),
  dataset_size: stats.candidateCount,
  query_count: queries.length,
  mode: stats.source === "cache" ? "cache" : "index",
  p50_ms: round(percentile(durations, 0.5)),
  p95_ms: round(percentile(durations, 0.95)),
  p99_ms: round(percentile(durations, 0.99)),
  latency_budget_ms: INDEX_SEARCH_BUDGET_MS,
  machine: {
    arch: machineArch(),
    cpus: [...new Set(cpus().map((cpu) => cpu.model))],
  },
  index: {
    handwritten_count: stats.handwrittenCount,
    synthetic_count: stats.syntheticCount,
    verified_count: stats.verifiedCount,
    messy_case_count: stats.messyCaseCount,
  },
};

if (stats.candidateCount < 500) {
  throw new Error(`expected at least 500 indexed candidates, got ${stats.candidateCount}`);
}

if (report.p95_ms > INDEX_SEARCH_BUDGET_MS) {
  throw new Error(`search p95 exceeded ${INDEX_SEARCH_BUDGET_MS} ms budget: ${report.p95_ms} ms`);
}

writeBenchmarkDoc(report);
console.log(JSON.stringify(report, null, 2));

function writeBenchmarkDoc(measurement: typeof report): void {
  const markdown = readFileSync(BENCHMARK_DOC_PATH, "utf8");
  const start = markdown.indexOf(BENCH_REPORT_MARKER_START);
  const end = markdown.indexOf(BENCH_REPORT_MARKER_END);

  if (start === -1 || end === -1 || end < start) {
    throw new Error(`benchmark markers missing in ${BENCHMARK_DOC_PATH}`);
  }

  const autoSection = [
    BENCH_REPORT_MARKER_START,
    "",
    `_Last updated: ${measurement.generated_at}_`,
    "",
    "## Latest index-search measurement",
    "",
    "| Field | Value |",
    "|---|---|",
    `| schema_version | \`${measurement.schema_version}\` |`,
    `| surface | \`${measurement.surface}\` |`,
    `| dataset_size | ${measurement.dataset_size} |`,
    `| query_count | ${measurement.query_count} |`,
    `| mode | \`${measurement.mode}\` |`,
    `| p50_ms | ${measurement.p50_ms} |`,
    `| p95_ms | ${measurement.p95_ms} |`,
    `| p99_ms | ${measurement.p99_ms} |`,
    `| latency_budget_ms | ${measurement.latency_budget_ms} |`,
    `| machine.arch | \`${measurement.machine.arch}\` |`,
    `| machine.cpus | ${measurement.machine.cpus.map((cpu) => `\`${cpu}\``).join(", ")} |`,
    "",
    "### Raw JSON",
    "",
    "```json",
    JSON.stringify(measurement, null, 2),
    "```",
    "",
    BENCH_REPORT_MARKER_END,
  ].join("\n");

  const updated = `${markdown.slice(0, start)}${autoSection}${markdown.slice(end + BENCH_REPORT_MARKER_END.length)}`;
  writeFileSync(BENCHMARK_DOC_PATH, updated);
}

function percentile(values: number[], fraction: number): number {
  const index = Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1);
  return values[index] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
