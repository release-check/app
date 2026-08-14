import { Hono } from "hono";
import { cors } from "hono/cors";
import { matchWithRustCore, type CoreMatchInput } from "./core-bridge";
import { normalize } from "./demo-index";
import {
  findIndexedAvailability,
  getSearchIndexStats,
  resolveIndexedUrl,
  searchReleaseIndex,
} from "./search-index";
import type {
  AvailabilityResponse,
  BatchItem,
  BatchResponse,
  ResolveResponse,
  SearchResponse,
} from "./types";

const app = new Hono();
const INDEXED_SEARCH_LATENCY_BUDGET_MS = 150;

app.use("*", cors());

app.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "release-check-api",
    index: "demo-cache",
    stats: getSearchIndexStats(),
  });
});

app.get("/index/stats", (c) => {
  return c.json(getSearchIndexStats());
});

app.get("/search", (c) => {
  const query = c.req.query("q") ?? "";
  const response: SearchResponse = {
    query: {
      q: query,
      normalized: normalize(query),
      source: responseIndexSource(),
      latencyBudgetMs: INDEXED_SEARCH_LATENCY_BUDGET_MS,
    },
    candidates: searchReleaseIndex(query).slice(0, 10),
  };

  return c.json(response);
});

app.get("/availability", (c) => {
  const artist = c.req.query("artist") ?? "";
  const track = c.req.query("track") ?? "";
  const candidate = findIndexedAvailability(artist, track);
  const response: AvailabilityResponse = {
    query: {
      artist,
      track,
      normalized: normalize(`${artist} ${track}`),
      source: responseIndexSource(),
      latencyBudgetMs: INDEXED_SEARCH_LATENCY_BUDGET_MS,
    },
    candidate,
    availability: candidate?.availability ?? null,
  };

  return c.json(response);
});

app.get("/resolve", (c) => {
  const url = c.req.query("url") ?? "";
  const response: ResolveResponse = {
    query: {
      url,
      source: responseIndexSource(),
      latencyBudgetMs: INDEXED_SEARCH_LATENCY_BUDGET_MS,
    },
    candidate: resolveIndexedUrl(url),
  };

  return c.json(response);
});

app.post("/batch", async (c) => {
  const payload = (await c.req.json().catch(() => ({}))) as { items?: BatchItem[] };
  const response: BatchResponse = {
    items: (payload.items ?? []).map((item) => {
      if (item.url) {
        const candidate = resolveIndexedUrl(item.url);
        return { input: item, candidates: candidate ? [candidate] : [] };
      }

      const query = item.q ?? [item.artist, item.track].filter(Boolean).join(" ");
      return { input: item, candidates: searchReleaseIndex(query) };
    }),
  };

  return c.json(response);
});

app.post("/core/match", async (c) => {
  const payload = (await c.req.json()) as CoreMatchInput;
  return c.json(await matchWithRustCore(payload));
});

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};

function responseIndexSource(): "demo-index" | "demo-cache" {
  return getSearchIndexStats().source === "cache" ? "demo-cache" : "demo-index";
}
