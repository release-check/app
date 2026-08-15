import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { normalize } from "./demo-index";
import type { AvailabilityEntry, Platform } from "./types";

export type AdapterMode = "official_api" | "public_index" | "manual_seed" | "not_configured";

export interface PlatformAdapterPolicy {
  platform: Platform;
  mode: AdapterMode;
  liveLookupAllowed: boolean;
  cacheTtlHours: number;
  note: string;
}

export interface AdapterSnapshot {
  platform: Platform;
  state: AvailabilityEntry["state"];
  url?: string;
  region?: string;
  note?: string;
  fetchedAt?: string;
}

export interface PlatformAdapter {
  platform: Platform;
  lookup(artist: string, title: string): Promise<AdapterSnapshot[]>;
}

export const ADAPTER_POLICIES: Record<Platform, PlatformAdapterPolicy> = {
  spotify: {
    platform: "spotify",
    mode: "official_api",
    liveLookupAllowed: false,
    cacheTtlHours: 24,
    note: "Use cached/indexed Spotify API data; do not fan out on user search.",
  },
  youtube_music: {
    platform: "youtube_music",
    mode: "public_index",
    liveLookupAllowed: false,
    cacheTtlHours: 24,
    note: "Use indexed public results only until API and policy boundaries are finalized.",
  },
  apple_music: {
    platform: "apple_music",
    mode: "official_api",
    liveLookupAllowed: false,
    cacheTtlHours: 24,
    note: "Use cached Apple Music catalog lookups outside the request path.",
  },
  soundcloud: {
    platform: "soundcloud",
    mode: "public_index",
    liveLookupAllowed: false,
    cacheTtlHours: 12,
    note: "Use indexed public results until official API credential path and policy are finalized.",
  },
  bandcamp: {
    platform: "bandcamp",
    mode: "manual_seed",
    liveLookupAllowed: false,
    cacheTtlHours: 168,
    note: "Use manual/public seed data until an acceptable ingestion policy is documented.",
  },
  melon: {
    platform: "melon",
    mode: "manual_seed",
    liveLookupAllowed: false,
    cacheTtlHours: 24,
    note: "No public API; manual seed with documented regional policy until a policy-aware ingestion path exists.",
  },
};

export function availabilityFromSnapshot(snapshot: AdapterSnapshot): AvailabilityEntry {
  const policy = ADAPTER_POLICIES[snapshot.platform];
  const mode =
    snapshot.platform === "spotify" && snapshot.note?.includes("not configured")
      ? "not_configured"
      : policy.mode;

  return {
    state: snapshot.state,
    url: snapshot.url,
    region: snapshot.region,
    note: snapshot.note ?? policy.note,
    source: mode,
    cachedAt: snapshot.fetchedAt,
  };
}

const DEFAULT_PLATFORM_CACHE_ROOT = fileURLToPath(
  new URL("../../../data/cache/platform", import.meta.url),
);

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search";

type FetchFn = typeof fetch;

interface PlatformCacheEntry {
  snapshots: AdapterSnapshot[];
  fetchedAt: string;
}

interface PlatformCacheDocument {
  entries: Record<string, PlatformCacheEntry>;
}

export interface PlatformCacheOptions {
  cacheRoot?: string;
  now?: () => Date;
  policy?: PlatformAdapterPolicy;
}

export interface SpotifyAdapterOptions {
  clientId?: string;
  clientSecret?: string;
  fetch?: FetchFn;
}

interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
}

interface SpotifySearchResponse {
  tracks?: {
    items?: Array<{
      id: string;
      name: string;
      external_urls?: { spotify?: string };
    }>;
  };
}

function cacheKey(artist: string, title: string): string {
  return `${normalize(artist)}|${normalize(title)}`;
}

function cacheFilePath(platform: Platform, cacheRoot: string): string {
  return `${cacheRoot}/${platform}.json`;
}

function readCacheDocument(platform: Platform, cacheRoot: string): PlatformCacheDocument {
  const path = cacheFilePath(platform, cacheRoot);
  if (!existsSync(path)) {
    return { entries: {} };
  }

  return JSON.parse(readFileSync(path, "utf8")) as PlatformCacheDocument;
}

function writeCacheDocument(
  platform: Platform,
  document: PlatformCacheDocument,
  cacheRoot: string,
): void {
  const path = cacheFilePath(platform, cacheRoot);
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

export function unknownAdapterSnapshot(
  platform: Platform,
  note?: string,
  fetchedAt?: string,
): AdapterSnapshot {
  const policy = ADAPTER_POLICIES[platform];
  return {
    platform,
    state: "unknown",
    note: note ?? policy.note,
    fetchedAt: fetchedAt ?? new Date().toISOString(),
  };
}

export async function lookupWithPlatformCache(
  adapter: PlatformAdapter,
  artist: string,
  title: string,
  options?: PlatformCacheOptions,
): Promise<AdapterSnapshot[]> {
  const cacheRoot = options?.cacheRoot ?? DEFAULT_PLATFORM_CACHE_ROOT;
  const now = options?.now?.() ?? new Date();
  const policy = options?.policy ?? ADAPTER_POLICIES[adapter.platform];
  const key = cacheKey(artist, title);
  const document = readCacheDocument(adapter.platform, cacheRoot);
  const cached = document.entries[key];

  if (cached && !isCacheExpired(cached.fetchedAt, policy.cacheTtlHours, now)) {
    return cached.snapshots;
  }

  if (!policy.liveLookupAllowed) {
    return [unknownAdapterSnapshot(adapter.platform, policy.note, now.toISOString())];
  }

  const snapshots = await adapter.lookup(artist, title);
  const stamped = snapshots.map((snapshot) => ({
    ...snapshot,
    fetchedAt: now.toISOString(),
  }));

  document.entries[key] = {
    snapshots: stamped,
    fetchedAt: now.toISOString(),
  };
  writeCacheDocument(adapter.platform, document, cacheRoot);

  return stamped;
}

export function withPlatformCache(
  adapter: PlatformAdapter,
  options?: PlatformCacheOptions,
): PlatformAdapter {
  return {
    platform: adapter.platform,
    lookup: (artist, title) => lookupWithPlatformCache(adapter, artist, title, options),
  };
}

export class SpotifyAdapter implements PlatformAdapter {
  readonly platform = "spotify" as const;

  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly fetchImpl: FetchFn;
  private tokenCache: { accessToken: string; expiresAtMs: number } | null = null;

  constructor(options?: SpotifyAdapterOptions) {
    this.clientId = options?.clientId ?? process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = options?.clientSecret ?? process.env.SPOTIFY_CLIENT_SECRET;
    this.fetchImpl = options?.fetch ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  async lookup(artist: string, title: string): Promise<AdapterSnapshot[]> {
    if (!this.isConfigured()) {
      return [
        {
          platform: this.platform,
          state: "unknown",
          note: "Spotify credentials not configured (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET).",
          fetchedAt: new Date().toISOString(),
        },
      ];
    }

    const accessToken = await this.getAccessToken();
    const query = encodeURIComponent(`artist:${artist} track:${title}`);
    const response = await this.fetchImpl(`${SPOTIFY_SEARCH_URL}?q=${query}&type=track&limit=5`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return [
        {
          platform: this.platform,
          state: "unknown",
          note: `Spotify search failed with status ${response.status}.`,
          fetchedAt: new Date().toISOString(),
        },
      ];
    }

    const payload = (await response.json()) as SpotifySearchResponse;
    const items = payload.tracks?.items ?? [];
    const fetchedAt = new Date().toISOString();

    if (items.length === 0) {
      return [
        {
          platform: this.platform,
          state: "missing",
          note: "No Spotify track match returned for artist/title query.",
          fetchedAt,
        },
      ];
    }

    return items.map((item) => ({
      platform: this.platform,
      state: "available" as const,
      url: item.external_urls?.spotify ?? `https://open.spotify.com/track/${item.id}`,
      note: item.name,
      fetchedAt,
    }));
  }

  private async getAccessToken(): Promise<string> {
    const nowMs = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAtMs > nowMs) {
      return this.tokenCache.accessToken;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const response = await this.fetchImpl(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      throw new Error(`Spotify token request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as SpotifyTokenResponse;
    this.tokenCache = {
      accessToken: payload.access_token,
      expiresAtMs: nowMs + payload.expires_in * 1000 - 60_000,
    };

    return this.tokenCache.accessToken;
  }
}

export const spotifyAdapter = withPlatformCache(new SpotifyAdapter());
