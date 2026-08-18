import type { CoreMatchInput } from "../apps/api/src/core-bridge";
import { searchReleaseIndex } from "../apps/api/src/search-index";
import type { Candidate } from "../apps/api/src/types";

interface GoldenCanonical {
  artist: string;
  title: string;
  release?: string;
  durationMs?: number;
  isrc?: string;
}

interface GoldenCase {
  id: string;
  canonical: GoldenCanonical;
  versionDistinction?: string;
  queries: string[];
  acceptableTop3Ids: string[];
}

interface GoldenSet {
  cases: GoldenCase[];
}

interface EvalGoldenCaseInput {
  source: CoreMatchInput["source"];
  candidates: CoreMatchInput["candidates"];
  acceptable_top3_ids: string[];
  candidate_ids: string[];
}

interface EvalGoldenRequest {
  cases: EvalGoldenCaseInput[];
  top_n: number;
}

interface EvalGoldenCaseResult {
  case_index: number;
  top3_hit: boolean;
  top_n_ids: string[];
  rejected_count: number;
  false_positive_count: number;
}

interface EvalGoldenResponse {
  case_results: EvalGoldenCaseResult[];
  top3_hits: number;
  rejected_count: number;
}

const defaultCargoManifest = new URL("../core/Cargo.toml", import.meta.url).pathname;
const goldenSet = (await Bun.file("data/golden-set.json").json()) as GoldenSet;

const request: EvalGoldenRequest = {
  top_n: 3,
  cases: goldenSet.cases.map((goldenCase) => {
    const indexedCandidates = searchReleaseIndex(goldenCase.queries[0] ?? "");
    return {
      source: sourceFromGoldenCanonical(goldenCase.canonical, goldenCase.versionDistinction),
      candidates: indexedCandidates.map(candidateToReleaseCandidate),
      acceptable_top3_ids: goldenCase.acceptableTop3Ids,
      candidate_ids: indexedCandidates.map((candidate) => candidate.id),
    };
  }),
};

const response = await runEvalGolden(request);

console.log(
  JSON.stringify(
    {
      caseCount: goldenSet.cases.length,
      top3_hits: response.top3_hits,
      rejected_count: response.rejected_count,
      cases: response.case_results.map((caseResult, index) => ({
        id: goldenSet.cases[index]?.id,
        query: goldenSet.cases[index]?.queries[0],
        pass: caseResult.top3_hit,
        top_n_ids: caseResult.top_n_ids,
        rejected_count: caseResult.rejected_count,
        false_positive_count: caseResult.false_positive_count,
        acceptable_top3_ids: goldenSet.cases[index]?.acceptableTop3Ids,
      })),
    },
    null,
    2,
  ),
);

if (response.case_results.some((caseResult) => !caseResult.top3_hit)) {
  process.exit(1);
}

function sourceFromGoldenCanonical(
  canonical: GoldenCanonical,
  versionDistinction?: string,
): CoreMatchInput["source"] {
  return {
    artist: canonical.artist,
    artist_aliases: [],
    title: canonical.title,
    album: canonical.release ?? null,
    version: versionDistinction ?? null,
    duration_ms: canonical.durationMs ?? null,
    isrc: canonical.isrc ?? null,
    url: null,
  };
}

function candidateToReleaseCandidate(candidate: Candidate): CoreMatchInput["candidates"][number] {
  return {
    platform: "demo-index",
    artist: candidate.canonical.artist,
    artist_aliases: [],
    title: candidate.canonical.title,
    album: candidate.canonical.release ?? null,
    version: candidate.ambiguity.join(" ") || null,
    duration_ms: candidate.canonical.durationSeconds
      ? candidate.canonical.durationSeconds * 1000
      : null,
    isrc: candidate.canonical.isrc ?? null,
    url: null,
    status: "available",
  };
}

async function runEvalGolden(input: EvalGoldenRequest): Promise<EvalGoldenResponse> {
  const command = process.env.RELEASE_CHECK_CORE_BIN
    ? [process.env.RELEASE_CHECK_CORE_BIN, "eval-golden"]
    : [
        "cargo",
        "run",
        "--quiet",
        "--manifest-path",
        defaultCargoManifest,
        "-p",
        "rc-worker",
        "--",
        "eval-golden",
      ];

  const proc = Bun.spawn(command, {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  proc.stdin.write(JSON.stringify(input));
  proc.stdin.end();

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`Rust core eval-golden failed (${exitCode}): ${stderr.trim()}`);
  }

  return JSON.parse(stdout) as EvalGoldenResponse;
}
