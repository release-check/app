export interface ReleaseCheckSearchResult {
  artist: string;
  title: string;
  confidence: number;
  platforms: Record<string, string | null>;
}

export class ReleaseCheckClient {
  constructor(private readonly baseUrl: string) {}

  async search(query: string): Promise<ReleaseCheckSearchResult[]> {
    const url = new URL("/search", this.baseUrl);
    url.searchParams.set("q", query);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ReleaseCheck search failed: ${response.status}`);
    }

    const payload = await response.json();
    return payload.results ?? [];
  }
}
