import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ADAPTER_POLICIES,
  lookupWithPlatformCache,
  SoundCloudAdapter,
  SpotifyAdapter,
  withPlatformCache,
  type AdapterSnapshot,
  type PlatformAdapter,
} from "../apps/api/src/adapters";

function makeSnapshot(
  platform: AdapterSnapshot["platform"],
  overrides: Partial<AdapterSnapshot> = {},
): AdapterSnapshot {
  return {
    platform,
    state: "available",
    url: "https://example.com/track",
    fetchedAt: "2026-08-14T12:00:00.000Z",
    ...overrides,
  };
}

describe("platform adapter cache", () => {
  let cacheRoot: string;

  beforeEach(() => {
    cacheRoot = mkdtempSync(join(tmpdir(), "rc-platform-cache-"));
  });

  afterEach(() => {
    rmSync(cacheRoot, { recursive: true, force: true });
  });

  test("cache hit returns snapshot without lookup", async () => {
    const lookup = mock(async () => [makeSnapshot("bandcamp")]);
    const adapter: PlatformAdapter = { platform: "bandcamp", lookup };

    const first = await lookupWithPlatformCache(adapter, "Aphex Twin", "Windowlicker", {
      cacheRoot,
      now: () => new Date("2026-08-14T12:00:00.000Z"),
      policy: { ...ADAPTER_POLICIES.bandcamp, liveLookupAllowed: true },
    });

    expect(first).toEqual([
      makeSnapshot("bandcamp", { fetchedAt: "2026-08-14T12:00:00.000Z" }),
    ]);
    expect(lookup).toHaveBeenCalledTimes(1);

    const second = await lookupWithPlatformCache(adapter, "Aphex Twin", "Windowlicker", {
      cacheRoot,
      now: () => new Date("2026-08-14T13:00:00.000Z"),
      policy: { ...ADAPTER_POLICIES.bandcamp, liveLookupAllowed: true },
    });

    expect(second).toEqual(first);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  test("cache miss with liveLookupAllowed=false returns unknown without lookup", async () => {
    const lookup = mock(async () => [makeSnapshot("bandcamp")]);
    const adapter: PlatformAdapter = { platform: "bandcamp", lookup };

    const snapshots = await lookupWithPlatformCache(adapter, "Artist", "Track", {
      cacheRoot,
      now: () => new Date("2026-08-14T12:00:00.000Z"),
    });

    expect(snapshots).toEqual([
      {
        platform: "bandcamp",
        state: "unknown",
        note: ADAPTER_POLICIES.bandcamp.note,
        fetchedAt: "2026-08-14T12:00:00.000Z",
      },
    ]);
    expect(lookup).not.toHaveBeenCalled();
  });

  test("TTL expiry triggers refresh through lookup", async () => {
    const lookup = mock(async () => [makeSnapshot("bandcamp", { url: "https://example.com/fresh" })]);
    const adapter: PlatformAdapter = { platform: "bandcamp", lookup };
    const policy = { ...ADAPTER_POLICIES.bandcamp, liveLookupAllowed: true, cacheTtlHours: 1 };

    await lookupWithPlatformCache(adapter, "Artist", "Track", {
      cacheRoot,
      now: () => new Date("2026-08-14T12:00:00.000Z"),
      policy,
    });

    const refreshed = await lookupWithPlatformCache(adapter, "Artist", "Track", {
      cacheRoot,
      now: () => new Date("2026-08-14T14:00:00.000Z"),
      policy,
    });

    expect(refreshed).toEqual([
      makeSnapshot("bandcamp", {
        url: "https://example.com/fresh",
        fetchedAt: "2026-08-14T14:00:00.000Z",
      }),
    ]);
    expect(lookup).toHaveBeenCalledTimes(2);
  });
});

describe("SpotifyAdapter", () => {
  const originalClientId = process.env.SPOTIFY_CLIENT_ID;
  const originalClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  afterEach(() => {
    if (originalClientId === undefined) {
      delete process.env.SPOTIFY_CLIENT_ID;
    } else {
      process.env.SPOTIFY_CLIENT_ID = originalClientId;
    }

    if (originalClientSecret === undefined) {
      delete process.env.SPOTIFY_CLIENT_SECRET;
    } else {
      process.env.SPOTIFY_CLIENT_SECRET = originalClientSecret;
    }
  });

  test("missing env degrades to not-configured behavior", async () => {
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;

    const fetchMock = mock(async () => new Response("unexpected", { status: 500 }));
    const adapter = new SpotifyAdapter({ fetch: fetchMock });

    const snapshots = await adapter.lookup("Artist", "Track");

    expect(snapshots).toEqual([
      {
        platform: "spotify",
        state: "unknown",
        note: "Spotify credentials not configured (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET).",
        fetchedAt: expect.any(String),
      },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(adapter.isConfigured()).toBe(false);
  });

  test("caches Spotify access tokens across lookups", async () => {
    const fetchMock = mock(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "https://accounts.spotify.com/api/token") {
        return new Response(JSON.stringify({ access_token: "token-1", expires_in: 3600 }), {
          status: 200,
        });
      }

      if (url.startsWith("https://api.spotify.com/v1/search")) {
        expect(init?.headers).toEqual({ Authorization: "Bearer token-1" });
        return new Response(
          JSON.stringify({
            tracks: {
              items: [
                {
                  id: "track-1",
                  name: "Windowlicker",
                  external_urls: { spotify: "https://open.spotify.com/track/track-1" },
                },
              ],
            },
          }),
          { status: 200 },
        );
      }

      return new Response("not found", { status: 404 });
    });

    const adapter = new SpotifyAdapter({
      clientId: "client-id",
      clientSecret: "client-secret",
      fetch: fetchMock,
    });

    const first = await adapter.lookup("Aphex Twin", "Windowlicker");
    const second = await adapter.lookup("Aphex Twin", "Windowlicker");

    expect(first).toEqual([
      {
        platform: "spotify",
        state: "available",
        url: "https://open.spotify.com/track/track-1",
        note: "Windowlicker",
        fetchedAt: expect.any(String),
      },
    ]);
    expect(second).toEqual([{ ...first[0], fetchedAt: expect.any(String) }]);

    const tokenCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("accounts.spotify.com/api/token"),
    );
    expect(tokenCalls).toHaveLength(1);
  });

  test("withPlatformCache does not call live lookup when policy blocks fan-out", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "rc-spotify-cache-"));

    try {
      const fetchMock = mock(async () => new Response("unexpected", { status: 500 }));
      const adapter = withPlatformCache(
        new SpotifyAdapter({
          clientId: "client-id",
          clientSecret: "client-secret",
          fetch: fetchMock,
        }),
        { cacheRoot },
      );

      const snapshots = await adapter.lookup("Artist", "Track");

      expect(snapshots).toEqual([
        {
          platform: "spotify",
          state: "unknown",
          note: ADAPTER_POLICIES.spotify.note,
          fetchedAt: expect.any(String),
        },
      ]);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });
});

describe("SoundCloudAdapter", () => {
  const originalClientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const originalClientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;

  afterEach(() => {
    if (originalClientId === undefined) delete process.env.SOUNDCLOUD_CLIENT_ID;
    else process.env.SOUNDCLOUD_CLIENT_ID = originalClientId;
    if (originalClientSecret === undefined) delete process.env.SOUNDCLOUD_CLIENT_SECRET;
    else process.env.SOUNDCLOUD_CLIENT_SECRET = originalClientSecret;
  });

  test("missing env degrades to not-configured behavior", async () => {
    delete process.env.SOUNDCLOUD_CLIENT_ID;
    delete process.env.SOUNDCLOUD_CLIENT_SECRET;

    const adapter = new SoundCloudAdapter();
    const snapshots = await adapter.lookup("Artist", "Track");

    expect(snapshots).toEqual([
      {
        platform: "soundcloud",
        state: "unknown",
        note: expect.stringContaining("not configured"),
        fetchedAt: expect.any(String),
      },
    ]);
  });

  test("caches SoundCloud access tokens across lookups", async () => {
    const fetchMock = mock(async (url: string | URL, init?: RequestInit) => {
      const target = String(url);
      if (target.includes("secure.soundcloud.com/oauth/token")) {
        return new Response(JSON.stringify({ access_token: "token-1", expires_in: 3600 }), {
          headers: { "content-type": "application/json" },
        });
      }
      if (target.includes("api-v2.soundcloud.com/search/tracks")) {
        return new Response(
          JSON.stringify({
            collection: [
              { id: 1, title: "Track", permalink_url: "https://soundcloud.com/user/track" },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });

    const adapter = new SoundCloudAdapter({
      clientId: "client-id",
      clientSecret: "client-secret",
      fetch: fetchMock,
    });

    const first = await adapter.lookup("Artist", "Track");
    const second = await adapter.lookup("Artist", "Track");

    expect(first[0]).toMatchObject({
      platform: "soundcloud",
      state: "available",
      url: "https://soundcloud.com/user/track",
    });
    expect(second).toEqual([{ ...first[0], fetchedAt: expect.any(String) }]);

    const tokenCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("secure.soundcloud.com/oauth/token"),
    );
    expect(tokenCalls).toHaveLength(1);
  });

  test("policy mode is public_index with fan-out blocked (official API deferred)", async () => {
    expect(ADAPTER_POLICIES.soundcloud.mode).toBe("public_index");
    expect(ADAPTER_POLICIES.soundcloud.liveLookupAllowed).toBe(false);
  });
});
