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
  return {
    state: snapshot.state,
    url: snapshot.url,
    region: snapshot.region,
    note: snapshot.note ?? ADAPTER_POLICIES[snapshot.platform].note,
    source: ADAPTER_POLICIES[snapshot.platform].mode,
    cachedAt: snapshot.fetchedAt,
  };
}
