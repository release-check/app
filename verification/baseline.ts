export const ITERATION_ID = "rc-app-baseline-20260717-01";
export const GATE_MATRIX_PATH =
  ".codex/evidence/rc-app-baseline-20260717-01/gate-matrix.json";
export const REPORT_SCHEMA_VERSION = "releasecheck.verification-report.v1";
export const REQUIRED_BASELINE_PROVENANCE_PATHS = [
  "apps/api/src/demo-index.ts",
  "data/evaluation-set.json",
  "data/golden-set.json",
] as const;

export const PLATFORM_KEYS = [
  "apple_music",
  "bandcamp",
  "melon",
  "soundcloud",
  "spotify",
  "youtube_music",
] as const;

export class GateFailure extends Error {}

export interface NegativeControlResult {
  name: string;
  expected: "FAIL";
  observed: "FAIL";
  passed: true;
}

export interface GateResult {
  measurements: Record<string, unknown>;
  negative_control: NegativeControlResult;
  limitations: string[];
}

export function assertGate(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new GateFailure(message);
  }
}

export function validateSearchPayload(payload: unknown, maximumCandidates = 10): void {
  assertGate(isRecord(payload), "search payload must be an object");
  assertGate(isRecord(payload.query), "search payload must include query metadata");
  assertGate(typeof payload.query.q === "string", "query.q must be a string");
  assertGate(typeof payload.query.normalized === "string", "query.normalized must be a string");
  assertGate(typeof payload.query.source === "string", "query.source must be a string");
  assertGate(
    typeof payload.query.latencyBudgetMs === "number",
    "query.latencyBudgetMs must be a number",
  );
  assertGate(Array.isArray(payload.candidates), "candidates must be an array");
  assertGate(
    payload.candidates.length <= maximumCandidates,
    `candidate count exceeds ${maximumCandidates}`,
  );

  for (const candidate of payload.candidates) {
    validateCandidate(candidate);
  }
}

export function validateProvenanceManifest(manifest: unknown): void {
  assertGate(isRecord(manifest), "provenance manifest must be an object");
  assertGate(
    manifest.schema_version === "releasecheck.provenance.v1",
    "unexpected provenance schema version",
  );
  assertGate(Array.isArray(manifest.fixtures), "provenance fixtures must be an array");
  assertGate(manifest.fixtures.length > 0, "provenance manifest must not be empty");

  const fixturePaths = manifest.fixtures
    .map((fixture) => (isRecord(fixture) ? fixture.path : undefined))
    .sort();
  assertGate(
    JSON.stringify(fixturePaths) === JSON.stringify(REQUIRED_BASELINE_PROVENANCE_PATHS),
    "provenance manifest must contain every baseline runtime fixture exactly once",
  );

  for (const fixture of manifest.fixtures) {
    assertGate(isRecord(fixture), "fixture provenance must be an object");
    for (const key of [
      "path",
      "content_sha256",
      "source_identifier",
      "classification",
      "verification_state",
      "permitted_use",
      "policy_note",
    ]) {
      assertGate(typeof fixture[key] === "string" && fixture[key].length > 0, `${key} is required`);
    }
    assertGate(
      /^[a-f0-9]{64}$/.test(fixture.content_sha256 as string),
      "content_sha256 must be a lowercase SHA-256",
    );
    assertGate(Array.isArray(fixture.labels), "fixture labels must be an array");
    assertGate(
      fixture.classification !== "handwritten_demo" || fixture.verification_state !== "verified",
      "handwritten demo data cannot be marked verified",
    );
    assertGate(
      fixture.classification !== "synthetic_load" || fixture.verification_state !== "verified",
      "synthetic load data cannot be marked verified",
    );
  }
}

export function enforceBenchmarkThresholds(measurement: {
  p95_milliseconds: number;
  maximum_response_bytes: number;
  maximum_ranked_candidates: number;
}): void {
  assertGate(measurement.p95_milliseconds <= 150, "p95 exceeds 150 ms");
  assertGate(
    measurement.maximum_response_bytes <= 262_144,
    "response exceeds 262144 bytes",
  );
  assertGate(measurement.maximum_ranked_candidates <= 10, "response exceeds top 10");
}

export function expectNegativeControl(name: string, action: () => unknown): NegativeControlResult {
  try {
    action();
  } catch (error) {
    if (error instanceof GateFailure) {
      return { name, expected: "FAIL", observed: "FAIL", passed: true };
    }
    throw error;
  }

  throw new GateFailure(`negative control did not fail: ${name}`);
}

export async function sha256File(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(await Bun.file(path).arrayBuffer());
  return hasher.digest("hex");
}

export async function runGate(
  gate: string,
  execute: () => Promise<GateResult>,
): Promise<void> {
  try {
    const result = await execute();
    const report = {
      schema_version: REPORT_SCHEMA_VERSION,
      iteration_id: ITERATION_ID,
      gate_matrix_hash: await sha256File(GATE_MATRIX_PATH),
      gate,
      scope: "app-baseline",
      verdict: "PASS",
      ...result,
    };
    console.log(JSON.stringify(report));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        schema_version: REPORT_SCHEMA_VERSION,
        iteration_id: ITERATION_ID,
        gate,
        scope: "app-baseline",
        verdict: "FAIL",
        error: message,
      }),
    );
    process.exitCode = 1;
  }
}

function validateCandidate(candidate: unknown): void {
  assertGate(isRecord(candidate), "candidate must be an object");
  assertGate(typeof candidate.id === "string" && candidate.id.length > 0, "candidate.id required");
  assertGate(isRecord(candidate.canonical), "candidate.canonical required");
  assertGate(typeof candidate.canonical.artist === "string", "canonical.artist required");
  assertGate(typeof candidate.canonical.title === "string", "canonical.title required");
  assertGate(
    typeof candidate.confidence === "number" &&
      Number.isFinite(candidate.confidence) &&
      candidate.confidence >= 0 &&
      candidate.confidence <= 1,
    "candidate.confidence must be between 0 and 1",
  );
  assertGate(Array.isArray(candidate.ambiguity), "candidate.ambiguity must be an array");
  assertGate(Array.isArray(candidate.evidence), "candidate.evidence must be an array");
  assertGate(candidate.evidence.length > 0, "candidate.evidence must not be empty");
  assertGate(isRecord(candidate.availability), "candidate.availability required");
  assertGate(
    JSON.stringify(Object.keys(candidate.availability).sort()) === JSON.stringify(PLATFORM_KEYS),
    "candidate availability must contain exactly the six v0 platforms",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
