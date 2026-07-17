import apiServer from "../apps/api/src/index";
import {
  assertGate,
  expectNegativeControl,
  runGate,
  validateSearchPayload,
} from "../verification/baseline";

interface EvaluationCase {
  name: string;
  query: string;
  expectedTop3Id: string;
  requiresAmbiguity?: string;
  minCandidates?: number;
}

interface SearchCandidate {
  id: string;
  ambiguity: string[];
}

const evaluationSet = (await Bun.file("data/evaluation-set.json").json()) as {
  cases: EvaluationCase[];
};

await runGate("baseline_quality_surface", async () => {
  assertGate(
    evaluationSet.cases.length >= 3,
    `expected at least 3 seed cases, got ${evaluationSet.cases.length}`,
  );
  const results = new Map<string, SearchCandidate[]>();

  for (const evaluationCase of evaluationSet.cases) {
    const response = await apiServer.fetch(
      new Request(
        `http://releasecheck.test/search?q=${encodeURIComponent(evaluationCase.query)}`,
      ),
    );
    assertGate(response.status === 200, `${evaluationCase.name} returned HTTP ${response.status}`);
    const payload = (await response.json()) as { candidates: SearchCandidate[] };
    validateSearchPayload(payload);
    results.set(evaluationCase.name, payload.candidates);
  }

  evaluateCases(evaluationSet.cases, results);

  const invalidCases = structuredClone(evaluationSet.cases);
  invalidCases[0]!.expectedTop3Id = "negative-control-missing-id";
  const negativeControl = expectNegativeControl("impossible_expected_top3_id", () =>
    evaluateCases(invalidCases, results),
  );

  return {
    measurements: {
      seed_cases: evaluationSet.cases.length,
      top_3_seed_failures: 0,
      ranked_ids: Object.fromEntries(
        [...results].map(([name, candidates]) => [name, candidates.slice(0, 3).map(({ id }) => id)]),
      ),
      fixture_classification: "handwritten_demo_unverified",
      verified_availability_claim: false,
    },
    negative_control: negativeControl,
    limitations: [
      "This baseline command validates the evaluation surface, not verified matching quality.",
      "Independent diagnostic and sealed terminal holdouts are deferred to the vertical slice.",
    ],
  };
});

function evaluateCases(
  cases: EvaluationCase[],
  results: ReadonlyMap<string, SearchCandidate[]>,
): void {
  for (const evaluationCase of cases) {
    const candidates = results.get(evaluationCase.name) ?? [];
    assertGate(
      candidates.slice(0, 3).some(({ id }) => id === evaluationCase.expectedTop3Id),
      `${evaluationCase.name}: expected candidate missing from top 3`,
    );
    assertGate(
      candidates.length >= (evaluationCase.minCandidates ?? 1),
      `${evaluationCase.name}: insufficient candidates`,
    );
    if (evaluationCase.requiresAmbiguity) {
      assertGate(
        candidates.some(({ ambiguity }) =>
          ambiguity.includes(evaluationCase.requiresAmbiguity as string),
        ),
        `${evaluationCase.name}: required ambiguity missing`,
      );
    }
  }
}
