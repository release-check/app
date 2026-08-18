import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  ADAPTER_POLICIES,
  lookupWithPlatformCache,
  SpotifyAdapter,
  type AdapterSnapshot,
} from "../apps/api/src/adapters";
import { normalize } from "../apps/api/src/demo-index";

interface GoldenSetCase {
  id: string;
  canonical: {
    artist: string;
    title: string;
  };
}

interface GoldenSetDocument {
  cases: GoldenSetCase[];
}

interface PlatformCacheEntry {
  snapshots: AdapterSnapshot[];
  fetchedAt: string;
}

interface PlatformCacheDocument {
  entries: Record<string, PlatformCacheEntry>;
}

type CacheDisposition = "hit" | "miss" | "not_configured";

const goldenSetPath = fileURLToPath(new URL("../data/golden-set.json", import.meta.url));
const cacheRoot = fileURLToPath(new URL("../data/cache/platform", import.meta.url));
const spotifyCachePath = `${cacheRoot}/spotify.json`;

const goldenSet = JSON.parse(readFileSync(goldenSetPath, "utf8")) as GoldenSetDocument;
const spotifyCore = new SpotifyAdapter();
const configured = Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);

function platformCacheKey(artist: string, title: string): string {
  return `${normalize(artist)}|${normalize(title)}`;
}

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

function resolveCacheDisposition(artist: string, title: string, now: Date): CacheDisposition {
  const key = platformCacheKey(artist, title);
  const cached = readSpotifyCache().entries[key];
  const ttlHours = ADAPTER_POLICIES.spotify.cacheTtlHours;

  if (cached && !isCacheExpired(cached.fetchedAt, ttlHours, now)) {
    return "hit";
  }

  if (!configured) {
    return "not_configured";
  }

  return "miss";
}

const now = new Date();
const tracks: Array<{
  id: string;
  artist: string;
  title: string;
  cache: CacheDisposition;
}> = [];

for (const goldenCase of goldenSet.cases) {
  const { artist, title } = goldenCase.canonical;
  const cache = resolveCacheDisposition(artist, title, now);

  await lookupWithPlatformCache(spotifyCore, artist, title, {
    cacheRoot,
    now: () => now,
    policy: {
      ...ADAPTER_POLICIES.spotify,
      liveLookupAllowed: configured,
    },
  });

  tracks.push({
    id: goldenCase.id,
    artist,
    title,
    cache,
  });
}

const summary = tracks.reduce(
  (counts, track) => {
    counts[track.cache] += 1;
    return counts;
  },
  { hit: 0, miss: 0, not_configured: 0 },
);

console.log(
  JSON.stringify(
    {
      platform: "spotify",
      configured,
      trackCount: tracks.length,
      summary,
      tracks,
    },
    null,
    2,
  ),
);
