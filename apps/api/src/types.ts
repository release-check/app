export const PLATFORMS = [
  "spotify",
  "youtube_music",
  "apple_music",
  "soundcloud",
  "bandcamp",
  "melon",
] as const;

export type Platform = (typeof PLATFORMS)[number];

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
}

export interface QueryMetadata {
  q: string;
  normalized: string;
  source: "demo-index";
  latencyBudgetMs: number;
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
    source: "demo-index";
    latencyBudgetMs: number;
  };
  candidate: Candidate | null;
  availability: PlatformAvailability | null;
}

export interface ResolveResponse {
  query: {
    url: string;
    source: "demo-index";
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
