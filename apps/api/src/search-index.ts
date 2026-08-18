import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { DEMO_INDEX, normalize } from "./demo-index";
import { VERIFIED_INDEX } from "./verified-index";
import { buildSyntheticCandidates } from "./synthetic-fixtures";
import type { Candidate } from "./types";

export interface SearchIndexStats {
  candidateCount: number;
  handwrittenCount: number;
  syntheticCount: number;
  verifiedCount: number;
  messyCaseCount: number;
  source: "cache" | "memory";
}

const cachePath = fileURLToPath(new URL("../../../data/cache/demo-index.json", import.meta.url));
const SEARCH_INDEX = loadSearchIndex();

export function getSearchIndex(): Candidate[] {
  return SEARCH_INDEX;
}

export function getSearchIndexStats(): SearchIndexStats {
  const handwrittenCount = SEARCH_INDEX.filter(
    (candidate) => candidate.sample?.origin !== "synthetic_load",
  ).length;
  const syntheticCount = SEARCH_INDEX.length - handwrittenCount;

  return {
    candidateCount: SEARCH_INDEX.length,
    handwrittenCount,
    syntheticCount,
    verifiedCount: SEARCH_INDEX.filter((candidate) => candidate.sample?.verified).length,
    messyCaseCount: SEARCH_INDEX.filter((candidate) => candidate.sample?.messyCase).length,
    source: existsSync(cachePath) ? "cache" : "memory",
  };
}

export function searchReleaseIndex(query: string): Candidate[] {
  const normalized = normalize(query);
  if (!normalized) {
    return [];
  }

  const terms = normalized.split(" ").filter(Boolean);

  return SEARCH_INDEX.map((candidate) => {
    const haystack = normalize(
      [
        candidate.canonical.artist,
        candidate.canonical.title,
        candidate.canonical.release ?? "",
        candidate.canonical.isrc ?? "",
        candidate.ambiguity.join(" "),
        candidate.sample?.scene ?? "",
      ].join(" "),
    );

    const matchedTerms = terms.filter((term) => haystack.includes(term)).length;
    const exactArtistTitle =
      normalize(`${candidate.canonical.artist} ${candidate.canonical.title}`) === normalized;
    const verifiedBoost = candidate.sample?.verified ? 0.1 : 0;
    const baseScore =
      matchedTerms / terms.length +
      (exactArtistTitle ? 1 : 0) +
      candidate.confidence * 0.1 +
      verifiedBoost;

    return { candidate, matchedTerms, score: baseScore };
  })
    .filter(({ matchedTerms }) => matchedTerms > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ candidate }) => candidate);
}

export interface Suggestion {
  id: string;
  artist: string;
  title: string;
}

export function suggestReleaseIndex(query: string, limit = 8): Suggestion[] {
  const normalized = normalize(query);
  if (!normalized) {
    return [];
  }

  const scored = SEARCH_INDEX.map((candidate) => {
    const artistNorm = normalize(candidate.canonical.artist);
    const titleNorm = normalize(candidate.canonical.title);
    const artistPrefix = artistNorm.startsWith(normalized);
    const titlePrefix = titleNorm.startsWith(normalized);
    const tokenPrefix = normalize(candidate.ambiguity.join(" ")).split(" ").some((token) =>
      token.startsWith(normalized),
    );
    if (!artistPrefix && !titlePrefix && !tokenPrefix) {
      return null;
    }

    const prefixLength = Math.max(
      artistPrefix ? normalized.length : 0,
      titlePrefix ? normalized.length : 0,
    );
    return {
      candidate,
      score: prefixLength + (artistPrefix ? 0.6 : 0) + (titlePrefix ? 0.4 : 0) + candidate.confidence * 0.05,
    };
  })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => right.score - left.score);

  const seen = new Set<string>();
  const suggestions: Suggestion[] = [];
  for (const { candidate } of scored) {
    const key = `${candidate.canonical.artist}|${candidate.canonical.title}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    suggestions.push({
      id: candidate.id,
      artist: candidate.canonical.artist,
      title: candidate.canonical.title,
    });
    if (suggestions.length >= limit) {
      break;
    }
  }

  return suggestions;
}

export function findIndexedAvailability(artist: string, track: string): Candidate | null {
  const normalizedArtist = normalize(artist);
  const normalizedTrack = normalize(track);

  return (
    SEARCH_INDEX.find(
      (candidate) =>
        normalize(candidate.canonical.artist) === normalizedArtist &&
        normalize(candidate.canonical.title) === normalizedTrack,
    ) ?? null
  );
}

export function resolveIndexedUrl(url: string): Candidate | null {
  const normalizedUrl = normalize(url);
  if (!normalizedUrl) {
    return null;
  }

  return (
    SEARCH_INDEX.find((candidate) =>
      Object.values(candidate.availability).some((entry) =>
        entry.url ? normalize(entry.url) === normalizedUrl : false,
      ),
    ) ?? null
  );
}

function loadSearchIndex(): Candidate[] {
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf8")) as Candidate[];
  }

  return [
    ...DEMO_INDEX.map((candidate) => ({
      ...candidate,
      sample: {
        origin: "handwritten_demo" as const,
        scene: "demo",
        messyCase: candidate.ambiguity.length > 0,
        verified: true,
      },
    })),
    ...VERIFIED_INDEX,
    ...buildSyntheticCandidates(),
  ];
}
