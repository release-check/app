import { describe, expect, test } from "bun:test";

import apiServer from "../apps/api/src/index";

interface SuggestResponse {
  query: { q: string; normalized: string; source: string };
  suggestions: Array<{ id: string; artist: string; title: string }>;
}

async function suggest(q: string): Promise<SuggestResponse> {
  const response = await apiServer.fetch(
    new Request(`http://releasecheck.test/suggest?q=${encodeURIComponent(q)}`),
  );
  expect(response.status).toBe(200);
  return (await response.json()) as SuggestResponse;
}

describe("GET /suggest", () => {
  test("prefix on artist surfaces the verified candidate", async () => {
    const payload = await suggest("newjeans");
    const ids = payload.suggestions.map((s) => s.id);
    expect(ids).toContain("verified-newjeans-ditto");
  });

  test("prefix on title surfaces the verified candidate", async () => {
    const payload = await suggest("ditto");
    const ids = payload.suggestions.map((s) => s.id);
    expect(ids).toContain("verified-newjeans-ditto");
  });

  test("caps suggestions at 8", async () => {
    const payload = await suggest("a");
    expect(payload.suggestions.length).toBeLessThanOrEqual(8);
  });

  test("empty query returns no suggestions", async () => {
    const payload = await suggest("");
    expect(payload.suggestions).toEqual([]);
  });

  test("unknown prefix returns no suggestions", async () => {
    const payload = await suggest("zzz-no-such-artist");
    expect(payload.suggestions).toEqual([]);
  });

  test("suggestions are deduplicated by artist+title", async () => {
    const payload = await suggest("angel");
    const keys = payload.suggestions.map((s) => `${s.artist}|${s.title}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
