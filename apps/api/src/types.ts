export const PLATFORMS = [
  "spotify",
  "youtube_music",
  "apple_music",
  "soundcloud",
  "bandcamp",
  "melon",
] as const;

export type Platform = (typeof PLATFORMS)[number];
export type IndexSource = "demo-index" | "demo-cache";

export type AvailabilityState =
  | "available"
  | "missing"
  | "unknown"
  | "region_locked"
  | "removed"
  | "duplicate_candidate";

export interface AvailabilityEntry {
  state: AvailabilityState;
  url?: string;
  region?: string;
  note?: string;
  source?: string;
  cachedAt?: string;
}

export type PlatformAvailability = Record<Platform, AvailabilityEntry>;

export interface MatchEvidence {
  field: string;
  score: number;
  note: string;
}

export interface CanonicalTrack {
  artist: string;
  title: string;
  release?: string;
  durationSeconds?: number;
  isrc?: string;
}

export interface Candidate {
  id: string;
  canonical: CanonicalTrack;
  confidence: number;
  ambiguity: string[];
  evidence: MatchEvidence[];
  availability: PlatformAvailability;
  sample?: {
    origin:
      | "handwritten_demo"
      | "synthetic_load"
      | "verified_musicbrainz"
      | "musicbrainz_ingested"
      | "live_lookup";
    scene: string;
    messyCase: boolean;
    verified: boolean;
  };
}

export interface QueryMetadata {
  q: string;
  normalized: string;
  source: IndexSource;
  latencyBudgetMs: number;
  liveLookup?: string;
}

export interface SearchResponse {
  query: QueryMetadata;
  candidates: Candidate[];
}

export interface AvailabilityResponse {
  query: {
    artist: string;
    track: string;
    normalized: string;
    source: IndexSource;
    latencyBudgetMs: number;
  };
  candidate: Candidate | null;
  availability: PlatformAvailability | null;
}

export interface ResolveResponse {
  query: {
    url: string;
    source: IndexSource;
    latencyBudgetMs: number;
  };
  candidate: Candidate | null;
}

export interface BatchItem {
  q?: string;
  artist?: string;
  track?: string;
  url?: string;
}

export interface BatchResponse {
  items: Array<{
    input: BatchItem;
    candidates: Candidate[];
  }>;
}
