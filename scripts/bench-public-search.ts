import { performance } from "node:perf_hooks";

import apiServer from "../apps/api/src/index";
import { DEMO_INDEX } from "../apps/api/src/demo-index";
import {
  enforceBenchmarkThresholds,
  expectNegativeControl,
  runGate,
  validateSearchPayload,
} from "../verification/baseline";

const WARMUPS = 25;
const MEASURED_REQUESTS = 250;
const PRESSURE_INPUTS = Array.from(
  { length: 500 },
  (_, index) => `rc-baseline-pressure-${String(index + 1).padStart(3, "0")}`,
);
const SEED_QUERIES = ["Park Hye Jin Like This", "Angel", "DJ Python Angel live demo"];

await runGate("baseline_public_performance", async () => {
  for (let index = 0; index < WARMUPS; index += 1) {
    await requestSearch(SEED_QUERIES[index % SEED_QUERIES.length]!);
  }

  const durations: number[] = [];
  let maximumResponseBytes = 0;
  let maximumRankedCandidates = 0;

  for (let index = 0; index < MEASURED_REQUESTS; index += 1) {
    const query =
      index % 2 === 0
        ? SEED_QUERIES[index % SEED_QUERIES.length]!
        : PRESSURE_INPUTS[index % PRESSURE_INPUTS.length]!;
    const startedAt = performance.now();
    const measurement = await requestSearch(query);
    durations.push(performance.now() - startedAt);
    maximumResponseBytes = Math.max(maximumResponseBytes, measurement.responseBytes);
    maximumRankedCandidates = Math.max(maximumRankedCandidates, measurement.rankedIds.length);
  }

  durations.sort((left, right) => left - right);
  const metrics = {
    p50_milliseconds: round(percentile(durations, 0.5)),
    p95_milliseconds: round(percentile(durations, 0.95)),
    p99_milliseconds: round(percentile(durations, 0.99)),
    maximum_response_bytes: maximumResponseBytes,
    maximum_ranked_candidates: maximumRankedCandidates,
  };
  enforceBenchmarkThresholds(metrics);

  const negativeControl = expectNegativeControl("latency_above_frozen_budget", () =>
    enforceBenchmarkThresholds({
      p95_milliseconds: 150.000001,
      maximum_response_bytes: metrics.maximum_response_bytes,
      maximum_ranked_candidates: metrics.maximum_ranked_candidates,
    }),
  );
  const stableProbe = await requestSearch("Angel");

  return {
    measurements: {
      warmups: WARMUPS,
      measured_requests: MEASURED_REQUESTS,
      cohort_counts: { seed_replay: 125, synthetic_pressure: 125 },
      synthetic_pressure_inputs: PRESSURE_INPUTS.length,
      starting_index_count: DEMO_INDEX.length,
      ranked_ids: stableProbe.rankedIds,
      ...metrics,
      latency_budget_milliseconds: 150,
      maximum_response_budget_bytes: 262_144,
      regression_claim: "candidate_baseline_only",
    },
    negative_control: negativeControl,
    limitations: [
      "Timing fields are volatile and excluded from deterministic equality checks.",
      "The baseline establishes a candidate metric; it does not claim no regression.",
      "Rust correlation and balanced verified cohorts become mandatory in the vertical slice.",
    ],
  };
});

async function requestSearch(query: string): Promise<{
  responseBytes: number;
  rankedIds: string[];
}> {
  const response = await apiServer.fetch(
    new Request(`http://releasecheck.test/search?q=${encodeURIComponent(query)}`),
  );
  const responseText = await response.text();
  const payload = JSON.parse(responseText) as { candidates: Array<{ id: string }> };
  validateSearchPayload(payload);

  return {
    responseBytes: new TextEncoder().encode(responseText).byteLength,
    rankedIds: payload.candidates.map(({ id }) => id),
  };
}

function percentile(values: number[], fraction: number): number {
  return values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
