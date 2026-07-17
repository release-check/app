import { describe, expect, test } from "bun:test";

import { DEMO_INDEX } from "../apps/api/src/demo-index";
import {
  enforceBenchmarkThresholds,
  expectNegativeControl,
  validateProvenanceManifest,
  validateSearchPayload,
} from "../verification/baseline";

describe("baseline verification primitives", () => {
  test("accepts the current six-platform candidate contract", () => {
    expect(() =>
      validateSearchPayload({
        query: {
          q: "Angel",
          normalized: "angel",
          source: "demo-index",
          latencyBudgetMs: 150,
        },
        candidates: DEMO_INDEX.slice(0, 1),
      }),
    ).not.toThrow();
  });

  test("rejects a candidate without evidence", () => {
    const candidate = structuredClone(DEMO_INDEX[0]) as Record<string, unknown>;
    delete candidate.evidence;

    expect(() =>
      validateSearchPayload({
        query: { q: "x", normalized: "x", source: "demo-index", latencyBudgetMs: 150 },
        candidates: [candidate],
      }),
    ).toThrow();
  });

  test("rejects handwritten fixtures marked as verified", () => {
    expect(() =>
      validateProvenanceManifest({
        schema_version: "releasecheck.provenance.v1",
        fixtures: [
          {
            path: "fixture.json",
            content_sha256: "a".repeat(64),
            source_identifier: "local:fixture",
            classification: "handwritten_demo",
            verification_state: "verified",
            labels: [],
            permitted_use: "smoke",
            policy_note: "negative control",
          },
        ],
      }),
    ).toThrow();
  });

  test("proves the benchmark latency negative control fails", () => {
    expect(
      expectNegativeControl("test_latency_over_budget", () =>
        enforceBenchmarkThresholds({
          p95_milliseconds: 151,
          maximum_response_bytes: 1,
          maximum_ranked_candidates: 1,
        }),
      ).passed,
    ).toBe(true);
  });

  test("does not treat unrelated exceptions as expected negative-control failures", () => {
    expect(() =>
      expectNegativeControl("unexpected_error", () => {
        throw new TypeError("unrelated implementation error");
      }),
    ).toThrow(TypeError);
  });
});
