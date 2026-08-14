import type { Candidate } from "./types";

export interface CoreMatchInput {
  source: {
    artist: string;
    artist_aliases: string[];
    title: string;
    album?: string | null;
    version?: string | null;
    duration_ms?: number | null;
    isrc?: string | null;
    url?: string | null;
  };
  candidates: Array<{
    platform: string;
    artist: string;
    artist_aliases: string[];
    title: string;
    album?: string | null;
    version?: string | null;
    duration_ms?: number | null;
    isrc?: string | null;
    url?: string | null;
    status: "available" | "missing" | "unknown";
  }>;
}

export interface CoreMatchResponse {
  decisions: Array<{
    candidate_index: number;
    status: string;
    confidence: number;
    evidence: Array<{ field: string; score: number; note: string }>;
  }>;
}

const defaultCargoManifest = new URL("../../../core/Cargo.toml", import.meta.url).pathname;

export async function matchWithRustCore(input: CoreMatchInput): Promise<CoreMatchResponse> {
  const command = process.env.RELEASE_CHECK_CORE_BIN
    ? [process.env.RELEASE_CHECK_CORE_BIN, "match-json"]
    : ["cargo", "run", "--quiet", "--manifest-path", defaultCargoManifest, "-p", "rc-worker", "--", "match-json"];

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
    throw new Error(`Rust core match failed (${exitCode}): ${stderr.trim()}`);
  }

  return JSON.parse(stdout) as CoreMatchResponse;
}

export function coreInputFromCandidatePair(source: Candidate, candidate: Candidate): CoreMatchInput {
  return {
    source: {
      artist: source.canonical.artist,
      artist_aliases: [],
      title: source.canonical.title,
      album: source.canonical.release ?? null,
      version: null,
      duration_ms: source.canonical.durationSeconds
        ? source.canonical.durationSeconds * 1000
        : null,
      isrc: source.canonical.isrc ?? null,
      url: null,
    },
    candidates: [
      {
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
      },
    ],
  };
}
