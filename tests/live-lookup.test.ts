import { afterEach, describe, expect, mock, test } from "bun:test";

import apiServer from "../apps/api/src/index";
import { _resetLiveLookupForTest } from "../apps/api/src/live-lookup";

const originalFetch = globalThis.fetch;

function itunesMockResponse() {
  return new Response(
    JSON.stringify({
      resultCount: 1,
      results: [
        {
          trackName: "Obscure Song",
          artistName: "Some Underground Artist",
          trackViewUrl: "https://music.apple.com/us/song/1234567890",
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  _resetLiveLookupForTest();
});

describe("live lookup on search miss", () => {
  test("miss triggers an iTunes lookup and returns an unverified candidate", async () => {
    const fetchMock = mock(async () => itunesMockResponse());
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await apiServer.fetch(
      new Request("http://releasecheck.test/search?q=Some%20Underground%20Artist%20Obscure%20Song"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      query: { liveLookup?: string };
      candidates: Array<{ id: string; origin: string; availability: Record<string, { state: string; url?: string }> }>;
    };

    expect(payload.query.liveLookup).toContain("unverified candidate");
    expect(payload.candidates[0]?.origin).toBe("live_lookup");
    expect(payload.candidates[0]?.availability.apple_music.state).toBe("available");
    expect(payload.candidates[0]?.availability.apple_music.url).toBe(
      "https://music.apple.com/us/song/1234567890",
    );
    expect(fetchMock).toHaveBeenCalled();
  });

  test("cooldown suppresses a second lookup", async () => {
    const fetchMock = mock(async () => itunesMockResponse());
    globalThis.fetch = fetchMock as typeof fetch;

    const query = "http://releasecheck.test/search?q=Some%20Underground%20Artist%20Obscure%20Song";
    await apiServer.fetch(new Request(query));
    const second = await apiServer.fetch(new Request(query));

    const payload = (await second.json()) as { query: { liveLookup?: string } };
    expect(payload.query.liveLookup).toContain("on cooldown");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("indexed hits never trigger a live lookup", async () => {
    const fetchMock = mock(async () => itunesMockResponse());
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await apiServer.fetch(
      new Request("http://releasecheck.test/search?q=NewJeans%20Ditto"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      query: { liveLookup?: string };
      candidates: Array<{ id: string }>;
    };
    expect(payload.query.liveLookup).toBeUndefined();
    expect(payload.candidates[0]?.id).toBe("verified-newjeans-ditto");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
