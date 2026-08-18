import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADAPTER_POLICIES,
  availabilityFromSnapshot,
  type AdapterSnapshot,
} from "../apps/api/src/adapters";
import { DEMO_INDEX, normalize } from "../apps/api/src/demo-index";
import { buildSyntheticCandidates } from "../apps/api/src/synthetic-fixtures";
import { VERIFIED_INDEX } from "../apps/api/src/verified-index";
import type { Candidate } from "../apps/api/src/types";

interface PlatformCacheEntry {
  snapshots: AdapterSnapshot[];
  fetchedAt: string;
}

interface PlatformCacheDocument {
  entries: Record<string, PlatformCacheEntry>;
}

const outputPath = new URL("../data/cache/demo-index.json", import.meta.url);
const spotifyCachePath = fileURLToPath(
  new URL("../data/cache/platform/spotify.json", import.meta.url),
);

function readSpotifyCache(): PlatformCacheDocument {
  if (!existsSync(spotifyCachePath)) {
    return { entries: {} };
  }

  return JSON.parse(readFileSync(spotifyCachePath, "utf8")) as PlatformCacheDocument;
}

function isCacheExpired(fetchedAt: string, ttlHours: number, now: Date): boolean {
  const fetchedMs = Date.parse(fetchedAt);
  if (Number.isNaN(fetchedMs)) {
    return true;
  }

  return now.getTime() - fetchedMs >= ttlHours * 60 * 60 * 1000;
}

function platformCacheKey(artist: string, title: string): string {
  return `${normalize(artist)}|${normalize(title)}`;
}

function enrichVerifiedSpotifyFromCache(candidates: Candidate[], now: Date): Candidate[] {
  const cache = readSpotifyCache();
  const ttlHours = ADAPTER_POLICIES.spotify.cacheTtlHours;

  return candidates.map((candidate) => {
    if (candidate.sample?.origin !== "verified_musicbrainz") {
      return candidate;
    }

    const key = platformCacheKey(candidate.canonical.artist, candidate.canonical.title);
    const cached = cache.entries[key];
    if (!cached || isCacheExpired(cached.fetchedAt, ttlHours, now)) {
      return candidate;
    }

    const snapshot =
      cached.snapshots.find((entry) => entry.platform === "spotify") ?? cached.snapshots[0];
    if (!snapshot) {
      return candidate;
    }

    return {
      ...candidate,
      availability: {
        ...candidate.availability,
        spotify: availabilityFromSnapshot(snapshot),
      },
    };
  });
}

const candidates = enrichVerifiedSpotifyFromCache(
  [
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
  ],
  new Date(),
);

mkdirSync(dirname(outputPath.pathname), { recursive: true });
await Bun.write(outputPath, `${JSON.stringify(candidates, null, 2)}\n`);

const messyCaseCount = candidates.filter((candidate) => candidate.sample.messyCase).length;
const handwrittenCount = DEMO_INDEX.length + VERIFIED_INDEX.length;

console.log(
  JSON.stringify(
    {
      output: outputPath.pathname,
      candidateCount: candidates.length,
      handwrittenCount,
      syntheticCount: candidates.length - handwrittenCount,
      verifiedCount: handwrittenCount,
      messyCaseCount,
    },
    null,
    2,
  ),
);
