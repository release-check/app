import { getSearchIndex, searchReleaseIndex } from "../apps/api/src/search-index";
import { PLATFORMS } from "../apps/api/src/types";
import {
  assertGate,
  expectNegativeControl,
  runGate,
} from "../verification/baseline";

interface EvaluationCase {
  name: string;
  query: string;
  expectedTop3Id: string;
}

interface GoldenCase {
  id: string;
  candidateId: string;
  queries: string[];
  acceptableTop3Ids: string[];
  platforms: Partial<
    Record<
      (typeof PLATFORMS)[number],
      {
        state: string;
      }
    >
  >;
}

interface GoldenSet {
  cases: GoldenCase[];
}

interface EvaluationSet {
  cases: EvaluationCase[];
}

interface QualityFailure {
  case_id?: string;
  name?: string;
  query: string;
  expected: string | string[];
  got: string[];
}

const goldenSet = (await Bun.file("data/golden-set.json").json()) as GoldenSet;
const evaluationSet = (await Bun.file("data/evaluation-set.json").json()) as EvaluationSet;

await runGate("matching_quality", async () => {
  const goldenFailures: QualityFailure[] = [];
  let goldenPasses = 0;
  let goldenQueries = 0;

  for (const goldenCase of goldenSet.cases) {
    for (const query of goldenCase.queries) {
      goldenQueries += 1;
      const top3Ids = searchReleaseIndex(query)
        .slice(0, 3)
        .map((candidate) => candidate.id);
      const hit = goldenCase.acceptableTop3Ids.some((candidateId) => top3Ids.includes(candidateId));

      if (hit) {
        goldenPasses += 1;
      } else {
        goldenFailures.push({
          case_id: goldenCase.id,
          query,
          expected: goldenCase.acceptableTop3Ids,
          got: top3Ids,
        });
      }
    }
  }

  const goldenPassRate = goldenQueries === 0 ? 0 : goldenPasses / goldenQueries;

  const evalFailures: QualityFailure[] = [];
  let evalPasses = 0;

  for (const evaluationCase of evaluationSet.cases) {
    const top3Ids = searchReleaseIndex(evaluationCase.query)
      .slice(0, 3)
      .map((candidate) => candidate.id);
    const hit = top3Ids.includes(evaluationCase.expectedTop3Id);

    if (hit) {
      evalPasses += 1;
    } else {
      evalFailures.push({
        name: evaluationCase.name,
        query: evaluationCase.query,
        expected: evaluationCase.expectedTop3Id,
        got: top3Ids,
      });
    }
  }

  const evalTop3Rate = evaluationSet.cases.length === 0 ? 0 : evalPasses / evaluationSet.cases.length;

  const indexedCandidates = getSearchIndex();
  let falsePositiveCount = 0;
  let falsePositiveDenominator = 0;
  let unknownCount = 0;
  let unknownDenominator = 0;

  for (const goldenCase of goldenSet.cases) {
    const candidate = indexedCandidates.find((entry) => entry.id === goldenCase.candidateId);
    assertGate(candidate, `golden candidate missing from index: ${goldenCase.candidateId}`);

    for (const platform of PLATFORMS) {
      const groundTruth = goldenCase.platforms[platform]?.state;
      if (!groundTruth) {
        continue;
      }

      const actualState = candidate.availability[platform].state;

      if (groundTruth === "missing" || groundTruth === "unknown") {
        falsePositiveDenominator += 1;
        if (actualState === "available") {
          falsePositiveCount += 1;
        }
      }

      if (groundTruth === "available" || groundTruth === "missing") {
        unknownDenominator += 1;
        if (actualState === "unknown") {
          unknownCount += 1;
        }
      }
    }
  }

  const falsePositiveRate =
    falsePositiveDenominator === 0 ? 0 : falsePositiveCount / falsePositiveDenominator;
  const unknownRate = unknownDenominator === 0 ? 0 : unknownCount / unknownDenominator;

  assertGate(goldenPassRate === 1, `golden_pass_rate ${round(goldenPassRate)} below 1.0`);
  assertGate(evalTop3Rate >= 0.9, `eval_top3_rate ${round(evalTop3Rate)} below 0.9`);
  assertGate(falsePositiveRate <= 0.05, `false_positive_rate ${round(falsePositiveRate)} above 0.05`);
  assertGate(unknownRate <= 0.1, `unknown_rate ${round(unknownRate)} above 0.1`);

  const invalidEvalCases = structuredClone(evaluationSet.cases);
  invalidEvalCases[0]!.expectedTop3Id = "negative-control-missing-id";
  const evalNegativeControl = expectNegativeControl("impossible_expected_top3_id", () =>
    evaluateEvalCases(invalidEvalCases),
  );

  const goldenNegativeControl = expectNegativeControl("golden_pass_rate_below_threshold", () =>
    assertGate(goldenPassRate >= 1.001, "negative control expects sub-100% golden pass rate to fail"),
  );

  return {
    measurements: {
      golden_pass_rate: round(goldenPassRate),
      eval_top3_rate: round(evalTop3Rate),
      false_positive_rate: round(falsePositiveRate),
      unknown_rate: round(unknownRate),
      golden_query_count: goldenQueries,
      eval_case_count: evaluationSet.cases.length,
      golden_failures: goldenFailures,
      eval_failures: evalFailures,
      false_positive_observations: falsePositiveCount,
      false_positive_denominator: falsePositiveDenominator,
      unknown_observations: unknownCount,
      unknown_denominator: unknownDenominator,
      negative_controls: [evalNegativeControl, goldenNegativeControl],
    },
    negative_control: evalNegativeControl,
    limitations: [
      "Golden and evaluation top-3 metrics use the local indexed search path, not live platform fan-out.",
      "False-positive and unknown rates compare indexed availability against golden-set platform ground truth only.",
    ],
  };
});

function evaluateEvalCases(cases: EvaluationCase[]): void {
  for (const evaluationCase of cases) {
    const top3Ids = searchReleaseIndex(evaluationCase.query)
      .slice(0, 3)
      .map((candidate) => candidate.id);

    assertGate(
      top3Ids.includes(evaluationCase.expectedTop3Id),
      `${evaluationCase.name}: expected ${evaluationCase.expectedTop3Id} in top 3, got ${top3Ids.join(", ") || "(empty)"}`,
    );
  }
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
