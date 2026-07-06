import { DEMO_INDEX, searchDemoIndex } from "../apps/api/src/demo-index";
import { PLATFORMS, type Candidate, type Platform } from "../apps/api/src/types";

interface EvalCase {
  name: string;
  query: string;
  expectedTop3Id: string;
  requiresAmbiguity?: string;
  minCandidates?: number;
}

interface EvaluationSet {
  cases: EvalCase[];
  requiredStateChecks: Array<{
    candidateId: string;
    platform: Platform;
    state: string;
  }>;
}

const evaluationSet = (await Bun.file("data/evaluation-set.json").json()) as EvaluationSet;
const evalCases = evaluationSet.cases;

const failures: string[] = [];

for (const evalCase of evalCases) {
  const candidates = searchDemoIndex(evalCase.query);
  const top3 = candidates.slice(0, 3);

  if (!top3.some((candidate) => candidate.id === evalCase.expectedTop3Id)) {
    failures.push(
      `${evalCase.name}: expected ${evalCase.expectedTop3Id} in top 3, got ${top3
        .map((candidate) => candidate.id)
        .join(", ")}`,
    );
  }

  if (evalCase.minCandidates && candidates.length < evalCase.minCandidates) {
    failures.push(
      `${evalCase.name}: expected at least ${evalCase.minCandidates} candidates, got ${candidates.length}`,
    );
  }

  if (
    evalCase.requiresAmbiguity &&
    !candidates.some((candidate) => candidate.ambiguity.includes(evalCase.requiresAmbiguity!))
  ) {
    failures.push(
      `${evalCase.name}: expected ambiguity marker ${evalCase.requiresAmbiguity}`,
    );
  }
}

for (const candidate of DEMO_INDEX) {
  assertSixPlatformStatuses(candidate);
  assertExplainedUncertainStates(candidate);
}

assertFalsePositiveGuards();

if (failures.length > 0) {
  console.error("Demo evaluation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Demo evaluation passed: ${evalCases.length} query cases, ${DEMO_INDEX.length} candidates.`);

function assertSixPlatformStatuses(candidate: Candidate): void {
  const actualPlatforms = Object.keys(candidate.availability).sort();
  const expectedPlatforms = [...PLATFORMS].sort();

  if (actualPlatforms.join(",") !== expectedPlatforms.join(",")) {
    failures.push(
      `${candidate.id}: expected platform keys ${expectedPlatforms.join(", ")}, got ${actualPlatforms.join(", ")}`,
    );
  }
}

function assertExplainedUncertainStates(candidate: Candidate): void {
  for (const platform of PLATFORMS) {
    const entry = candidate.availability[platform];
    const needsExplanation = entry.state !== "available" && entry.state !== "missing";

    if (needsExplanation && !entry.note) {
      failures.push(`${candidate.id}.${platform}: ${entry.state} needs a note`);
    }
  }
}

function assertFalsePositiveGuards(): void {
  for (const expected of evaluationSet.requiredStateChecks) {
    const candidate = DEMO_INDEX.find((item) => item.id === expected.candidateId);
    const actualState = candidate?.availability[expected.platform].state;

    if (actualState !== expected.state) {
      failures.push(
        `${expected.candidateId}.${expected.platform}: expected ${expected.state}, got ${actualState ?? "missing candidate"}`,
      );
    }
  }
}
