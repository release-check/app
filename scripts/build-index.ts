import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { DEMO_INDEX } from "../apps/api/src/demo-index";
import { VERIFIED_INDEX } from "../apps/api/src/verified-index";
import { buildSyntheticCandidates } from "../apps/api/src/synthetic-fixtures";
import {
  ADAPTER_POLICIES,
  availabilityFromSnapshot,
  type AdapterSnapshot,
} from "../apps/api/src/adapters";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalize } from "../apps/api/src/demo-index";
import type { Candidate, Platform } from "../apps/api/src/types";

const outputPath = new URL("../data/cache/demo-index.json", import.meta.url);
const cacheRoot = fileURLToPath(new URL("../data/cache/platform", import.meta.url));

interface PlatformCacheEntry {
  snapshots: AdapterSnapshot[];
  fetchedAt: string;
}

interface PlatformCacheDocument {
  entries: Record<string, PlatformCacheEntry>;
}

const ENRICHABLE_PLATFORMS: Platform[] = ["spotify", "soundcloud"];

function readPlatformCache(platform: Platform): PlatformCacheDocument {
  const path = `${cacheRoot}/${platform}.json`;
  if (!existsSync(path)) {
    return { entries: {} };
  }

  return JSON.parse(readFileSync(path, "utf8")) as PlatformCacheDocument;
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

function enrichVerifiedFromCache(candidates: Candidate[], now: Date): Candidate[] {
  return candidates.map((candidate) => {
    if (candidate.sample?.origin !== "verified_musicbrainz") {
      return candidate;
    }

    const key = platformCacheKey(candidate.canonical.artist, candidate.canonical.title);
    let availability = candidate.availability;

    for (const platform of ENRICHABLE_PLATFORMS) {
      const cache = readPlatformCache(platform);
      const cached = cache.entries[key];
      const ttlHours = ADAPTER_POLICIES[platform].cacheTtlHours;
      if (!cached || isCacheExpired(cached.fetchedAt, ttlHours, now)) {
        continue;
      }

      const snapshot =
        cached.snapshots.find((entry) => entry.platform === platform) ?? cached.snapshots[0];
      if (!snapshot) {
        continue;
      }

      // Real results only — degraded/unknown snapshots must not clobber
      // hand-verified URLs with "unknown".
      if (snapshot.state !== "available" && snapshot.state !== "missing") {
        continue;
      }

      availability = {
        ...availability,
        [platform]: availabilityFromSnapshot(snapshot),
      };
    }

    return availability === candidate.availability ? candidate : { ...candidate, availability };
  });
}

const candidates = enrichVerifiedFromCache(
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
      enrichedPlatforms: ENRICHABLE_PLATFORMS,
    },
    null,
    2,
  ),
);
