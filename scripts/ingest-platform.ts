import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADAPTER_POLICIES,
  soundCloudAdapter,
  SoundCloudAdapter,
  spotifyAdapter,
  SpotifyAdapter,
  type AdapterSnapshot,
  type PlatformAdapter,
} from "../apps/api/src/adapters";
import { normalize } from "../apps/api/src/demo-index";
import type { Platform } from "../apps/api/src/types";

interface GoldenSetCase {
  id: string;
  canonical: {
    artist: string;
    title: string;
    release?: string;
    durationMs?: number;
    isrc?: string;
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

type CacheDisposition = "hit" | "fetched" | "not_configured";

const goldenSetPath = fileURLToPath(new URL("../data/golden-set.json", import.meta.url));
const cacheRoot = fileURLToPath(new URL("../data/cache/platform", import.meta.url));

const goldenSet = JSON.parse(readFileSync(goldenSetPath, "utf8")) as GoldenSetDocument;

interface IngestAdapter {
  platform: Platform;
  adapter: PlatformAdapter;
  configured: boolean;
}

const adapters: IngestAdapter[] = [
  {
    platform: "spotify",
    adapter: spotifyAdapter,
    configured: new SpotifyAdapter().isConfigured(),
  },
  {
    platform: "soundcloud",
    adapter: soundCloudAdapter,
    configured: new SoundCloudAdapter().isConfigured(),
  },
];

function platformCacheKey(artist: string, title: string): string {
  return `${normalize(artist)}|${normalize(title)}`;
}

function readCache(platform: Platform): PlatformCacheDocument {
  const path = `${cacheRoot}/${platform}.json`;
  if (!existsSync(path)) {
    return { entries: {} };
  }
  return JSON.parse(readFileSync(path, "utf8")) as PlatformCacheDocument;
}

function writeCache(platform: Platform, document: PlatformCacheDocument): void {
  const path = `${cacheRoot}/${platform}.json`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

function isCacheExpired(fetchedAt: string, ttlHours: number, now: Date): boolean {
  const fetchedMs = Date.parse(fetchedAt);
  if (Number.isNaN(fetchedMs)) {
    return true;
  }
  return now.getTime() - fetchedMs >= ttlHours * 60 * 60 * 1000;
}

async function ingestForAdapter(
  ingest: IngestAdapter,
  now: Date,
): Promise<
  Array<{ id: string; artist: string; title: string; cache: CacheDisposition; snapshots: number }>
> {
  const policy = ADAPTER_POLICIES[ingest.platform];
  const results: Array<{
    id: string;
    artist: string;
    title: string;
    cache: CacheDisposition;
    snapshots: number;
  }> = [];

  for (const goldenCase of goldenSet.cases) {
    const artist = goldenCase.canonical.artist;
    const title = goldenCase.canonical.title;
    const key = platformCacheKey(artist, title);
    const document = readCache(ingest.platform);
    const cached = document.entries[key];

    if (cached && !isCacheExpired(cached.fetchedAt, policy.cacheTtlHours, now)) {
      results.push({
        id: goldenCase.id,
        artist,
        title,
        cache: "hit",
        snapshots: cached.snapshots.length,
      });
      continue;
    }

    if (!ingest.configured) {
      results.push({ id: goldenCase.id, artist, title, cache: "not_configured", snapshots: 0 });
      continue;
    }

    // Background ingest path: live lookup is allowed here (request path stays
    // cache-only via liveLookupAllowed=false). The adapter writes no cache
    // itself, so we persist the stamped snapshots directly.
    const snapshots = await ingest.adapter.lookup(artist, title);
    const stamped = snapshots.map((snapshot) => ({
      ...snapshot,
      fetchedAt: now.toISOString(),
    }));
    const nextDocument = readCache(ingest.platform);
    nextDocument.entries[key] = { snapshots: stamped, fetchedAt: now.toISOString() };
    writeCache(ingest.platform, nextDocument);

    results.push({ id: goldenCase.id, artist, title, cache: "fetched", snapshots: stamped.length });
  }

  return results;
}

const now = new Date();
const perPlatform: Record<string, unknown> = {};

for (const ingest of adapters) {
  perPlatform[ingest.platform] = await ingestForAdapter(ingest, now);
}

console.log(
  JSON.stringify(
    {
      trackCount: goldenSet.cases.length,
      perPlatform,
    },
    null,
    2,
  ),
);
