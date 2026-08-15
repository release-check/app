import { describe, expect, test } from "bun:test";

import {
  CHECKED_FIELDS,
  DEFAULT_USER_AGENT,
  MUSICBRAINZ_POLICY,
  MusicBrainzRateLimiter,
  RATE_LIMIT_INTERVAL_MS,
  buildRecordingLookupUrl,
  ingestMusicBrainzRecording,
  mapMusicBrainzResponsesToSeed,
  type MusicBrainzIngestSeed,
} from "../scripts/ingest-musicbrainz";

const RECORDING_MBID = "adf44a12-e5f4-48aa-9029-b9ef4b5f1d6d";
const RELEASE_MBID = "4e9c7e78-568f-4643-b2a8-b5a59ee2ca87";
const TRACK_MBID = "4a5f8dd3-73e4-40e2-bf5e-882de8be55b1";
const RELEASE_GROUP_MBID = "f99c9e74-52e3-47cb-9286-ce0019a9b69a";
const ARTIST_MBID = "49204a7a-ed85-407a-828f-6fd46f1d8126";

const mockRecordingResponse = {
  id: RECORDING_MBID,
  title: "Ditto",
  length: 186000,
  isrcs: ["usa2p2254487"],
  "artist-credit": [
    {
      name: "NewJeans",
      artist: { id: ARTIST_MBID, name: "NewJeans" },
    },
  ],
  releases: [
    {
      id: RELEASE_MBID,
      title: "Ditto",
      status: "Official",
      date: "2022-12-19",
      "release-group": { id: RELEASE_GROUP_MBID },
    },
    {
      id: "00000000-0000-0000-0000-000000000001",
      title: "Bootleg Ditto",
      status: "Bootleg",
      date: "2023-01-01",
      "release-group": { id: "00000000-0000-0000-0000-000000000002" },
    },
  ],
};

const mockReleaseResponse = {
  id: RELEASE_MBID,
  media: [
    {
      tracks: [
        {
          id: TRACK_MBID,
          title: "Ditto",
          length: 186000,
          recording: { id: RECORDING_MBID },
        },
      ],
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createMockFetch(
  schedule: Array<{ status?: number; body?: unknown; failCount?: number }>,
  clock: () => number = () => Date.now(),
): { fetchFn: typeof fetch; calls: Array<{ url: string; userAgent: string | null; at: number }> } {
  const calls: Array<{ url: string; userAgent: string | null; at: number }> = [];
  let callIndex = 0;

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      userAgent: typeof init?.headers === "object" && init.headers !== null && !Array.isArray(init.headers)
        ? String((init.headers as Record<string, string>)["User-Agent"] ?? null)
        : null,
      at: clock(),
    });

    const step = schedule[Math.min(callIndex, schedule.length - 1)] ?? schedule[schedule.length - 1];
    callIndex += 1;

    if (step.failCount && callIndex <= step.failCount) {
      return jsonResponse({ error: "rate limited" }, step.status ?? 429);
    }

    return jsonResponse(step.body ?? {}, step.status ?? 200);
  }) as typeof fetch;

  return { fetchFn, calls };
}

function expectSeedShape(seed: MusicBrainzIngestSeed): void {
  expect(seed.classification).toBe("verified_musicbrainz_recording");
  expect(seed.identity.recording_mbid).toBe(RECORDING_MBID);
  expect(seed.identity.track_mbid).toBe(TRACK_MBID);
  expect(seed.identity.release_mbid).toBe(RELEASE_MBID);
  expect(seed.identity.release_group_mbid).toBe(RELEASE_GROUP_MBID);
  expect(seed.identity.artist_mbids).toEqual([ARTIST_MBID]);

  expect(seed.metadata.title).toBe("Ditto");
  expect(seed.metadata.artist_credit).toBe("NewJeans");
  expect(seed.metadata.release_title).toBe("Ditto");
  expect(seed.metadata.release_status).toBe("official");
  expect(seed.metadata.release_date).toBe("2022-12-19");
  expect(seed.metadata.duration_ms).toBe(186000);
  expect(seed.metadata.duration_precision).toBe("display_seconds");
  expect(seed.metadata.isrcs).toEqual(["USA2P2254487"]);

  expect(seed.source.provider).toBe("MusicBrainz");
  expect(seed.source.source_identifier).toBe(`musicbrainz:recording:${RECORDING_MBID}`);
  expect(seed.source.recording_url).toBe(`https://musicbrainz.org/recording/${RECORDING_MBID}`);
  expect(seed.source.release_url).toBe(`https://musicbrainz.org/release/${RELEASE_MBID}`);
  expect(seed.source.api_lookup_url).toBe(buildRecordingLookupUrl(RECORDING_MBID));
  expect(seed.source.retrieval_method).toBe("musicbrainz_ws2_recording_lookup");
  expect(seed.source.retrieved_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

  expect(seed.label.kind).toBe("positive_recording_identity");
  expect(seed.label.expected_relationship).toBe("exact_musicbrainz_recording");
  expect(seed.label.expected_recording_mbid).toBe(RECORDING_MBID);

  expect(seed.verification.state).toBe("api_retrieved");
  expect(seed.verification.verified_by_role).toBe("ingest_script");
  expect(seed.verification.checked_fields).toEqual([...CHECKED_FIELDS]);

  expect(seed.policy_provenance.license_id).toBe("CC0-1.0");
  expect(seed.policy_provenance.data_scope).toBe("core_metadata_only");
  expect(seed.policy_provenance.redistribution).toBe("permitted_core_metadata");
  expect(seed.policy_provenance.policy_note).toContain("annotations");
  expect(seed.policy_provenance.policy_note).toContain("cover art");
}

describe("ingest-musicbrainz", () => {
  test("maps mocked MusicBrainz responses into the seed schema", async () => {
    const { fetchFn } = createMockFetch([
      { body: mockRecordingResponse },
      { body: mockReleaseResponse },
    ]);

    const seed = await ingestMusicBrainzRecording({
      recordingMbid: RECORDING_MBID,
      artistHint: "NewJeans",
      titleHint: "Ditto",
      seedId: "mb-positive-newjeans-ditto",
      fetchFn,
      now: () => new Date("2026-08-14T12:00:00.000Z"),
    });

    expectSeedShape(seed);
    expect(seed.seed_id).toBe("mb-positive-newjeans-ditto");
    expect(seed.label.rationale).toContain("Artist hint: NewJeans.");
    expect(seed.label.rationale).toContain("Title hint: Ditto.");
  });

  test("sends a meaningful User-Agent on every mocked request", async () => {
    const { fetchFn, calls } = createMockFetch([
      { body: mockRecordingResponse },
      { body: mockReleaseResponse },
    ]);

    await ingestMusicBrainzRecording({
      recordingMbid: RECORDING_MBID,
      fetchFn,
      userAgent: DEFAULT_USER_AGENT,
      rateLimiter: new MusicBrainzRateLimiter(0),
      now: () => new Date("2026-08-14T12:00:00.000Z"),
    });

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.userAgent).toBe(DEFAULT_USER_AGENT);
      expect(call.userAgent).toContain("ReleaseCheck");
      expect(call.userAgent).toContain("musicbrainz-ingest");
    }
  });

  test("spaces mocked requests by at least one second", async () => {
    let nowMs = 0;
    const sleepCalls: number[] = [];
    const rateLimiter = new MusicBrainzRateLimiter(
      RATE_LIMIT_INTERVAL_MS,
      async (ms) => {
        sleepCalls.push(ms);
        nowMs += ms;
      },
      () => nowMs,
    );

    const { fetchFn, calls } = createMockFetch(
      [
        { body: mockRecordingResponse },
        { body: mockReleaseResponse },
      ],
      () => nowMs,
    );

    await ingestMusicBrainzRecording({
      recordingMbid: RECORDING_MBID,
      fetchFn,
      rateLimiter,
      now: () => new Date("2026-08-14T12:00:00.000Z"),
    });

    expect(calls).toHaveLength(2);
    expect(sleepCalls).toEqual([RATE_LIMIT_INTERVAL_MS]);
    expect(calls[1].at - calls[0].at).toBeGreaterThanOrEqual(RATE_LIMIT_INTERVAL_MS);
  });

  test("retries mocked 429 and 5xx responses before succeeding", async () => {
    let attempt = 0;
    const fetchFn = (async () => {
      attempt += 1;
      if (attempt === 1) {
        return jsonResponse({ error: "slow down" }, 429);
      }
      if (attempt === 2) {
        return jsonResponse({ error: "server error" }, 503);
      }
      if (attempt === 3) {
        return jsonResponse(mockRecordingResponse, 200);
      }
      return jsonResponse(mockReleaseResponse, 200);
    }) as typeof fetch;

    const rateLimiter = new MusicBrainzRateLimiter(0);

    const seed = await ingestMusicBrainzRecording({
      recordingMbid: RECORDING_MBID,
      fetchFn,
      rateLimiter,
      now: () => new Date("2026-08-14T12:00:00.000Z"),
    });

    expect(attempt).toBe(4);
    expectSeedShape(seed);
  });

  test("documents the seed policy block constants used by ingest output", () => {
    expect(MUSICBRAINZ_POLICY.redistributed_fields).toBe("musicbrainz_core_metadata_only");
    expect(MUSICBRAINZ_POLICY.excluded_fields).toEqual([
      "annotations",
      "audio",
      "cover_art",
      "edit_history",
      "ratings",
      "tags",
    ]);
    expect(MUSICBRAINZ_POLICY.api_usage.meaningful_user_agent_required).toBe(true);
    expect(MUSICBRAINZ_POLICY.api_usage.source_ip_average_requests_per_second_maximum).toBe(1);
    expect(MUSICBRAINZ_POLICY.api_usage.polling_for_changes_allowed).toBe(false);
  });

  test("mapMusicBrainzResponsesToSeed preserves whitelist-only metadata", () => {
    const seed = mapMusicBrainzResponsesToSeed({
      recording: mockRecordingResponse,
      release: mockReleaseResponse,
      selectedRelease: mockRecordingResponse.releases[0],
      track: mockReleaseResponse.media[0].tracks[0],
      retrievedAt: "2026-08-14T12:00:00Z",
    });

    expectSeedShape(seed);
    expect(Object.keys(seed)).toEqual([
      "seed_id",
      "classification",
      "identity",
      "metadata",
      "source",
      "label",
      "verification",
      "policy_provenance",
    ]);
  });
});
