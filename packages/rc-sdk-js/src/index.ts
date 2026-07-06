export type ReleaseCheckPlatform =
  | "spotify"
  | "youtube_music"
  | "apple_music"
  | "soundcloud"
  | "bandcamp"
  | "melon";

export type ReleaseCheckAvailabilityState =
  | "available"
  | "missing"
  | "unknown"
  | "region_locked"
  | "removed"
  | "duplicate_candidate";

export interface ReleaseCheckAvailabilityEntry {
  state: ReleaseCheckAvailabilityState;
  url?: string;
  region?: string;
  note?: string;
}

export type ReleaseCheckPlatformAvailability = Record<
  ReleaseCheckPlatform,
  ReleaseCheckAvailabilityEntry
>;

export interface ReleaseCheckMatchEvidence {
  field: string;
  score: number;
  note: string;
}

export interface ReleaseCheckCanonicalTrack {
  artist: string;
  title: string;
  release?: string;
  durationSeconds?: number;
  isrc?: string;
}

export interface ReleaseCheckCandidate {
  id: string;
  canonical: ReleaseCheckCanonicalTrack;
  confidence: number;
  ambiguity: string[];
  evidence: ReleaseCheckMatchEvidence[];
  availability: ReleaseCheckPlatformAvailability;
}

export interface ReleaseCheckSearchResponse {
  query: {
    q: string;
    normalized: string;
    source: string;
    latencyBudgetMs: number;
  };
  candidates: ReleaseCheckCandidate[];
}

export interface ReleaseCheckAvailabilityResponse {
  query: {
    artist: string;
    track: string;
    normalized: string;
    source: string;
    latencyBudgetMs: number;
  };
  candidate: ReleaseCheckCandidate | null;
  availability: ReleaseCheckPlatformAvailability | null;
}

export interface ReleaseCheckResolveResponse {
  query: {
    url: string;
    source: string;
    latencyBudgetMs: number;
  };
  candidate: ReleaseCheckCandidate | null;
}

export interface ReleaseCheckBatchItem {
  q?: string;
  artist?: string;
  track?: string;
  url?: string;
}

export interface ReleaseCheckBatchResponse {
  items: Array<{
    input: ReleaseCheckBatchItem;
    candidates: ReleaseCheckCandidate[];
  }>;
}

export class ReleaseCheckClient {
  constructor(private readonly baseUrl: string) {}

  async search(query: string): Promise<ReleaseCheckSearchResponse> {
    const url = new URL("/search", this.baseUrl);
    url.searchParams.set("q", query);

    return this.getJson(url, "search");
  }

  async availability(
    artist: string,
    track: string,
  ): Promise<ReleaseCheckAvailabilityResponse> {
    const url = new URL("/availability", this.baseUrl);
    url.searchParams.set("artist", artist);
    url.searchParams.set("track", track);

    return this.getJson(url, "availability");
  }

  async resolve(urlToResolve: string): Promise<ReleaseCheckResolveResponse> {
    const url = new URL("/resolve", this.baseUrl);
    url.searchParams.set("url", urlToResolve);

    return this.getJson(url, "resolve");
  }

  async batch(items: ReleaseCheckBatchItem[]): Promise<ReleaseCheckBatchResponse> {
    const url = new URL("/batch", this.baseUrl);
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      throw new Error(`ReleaseCheck batch failed: ${response.status}`);
    }

    return response.json() as Promise<ReleaseCheckBatchResponse>;
  }

  private async getJson<T>(url: URL, operation: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ReleaseCheck ${operation} failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }
}
