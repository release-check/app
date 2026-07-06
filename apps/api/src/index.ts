import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  findAvailability,
  normalize,
  resolveDemoUrl,
  searchDemoIndex,
} from "./demo-index";
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
    index: "demo",
  });
});

app.get("/search", (c) => {
  const query = c.req.query("q") ?? "";
  const response: SearchResponse = {
    query: {
      q: query,
      normalized: normalize(query),
      source: "demo-index",
      latencyBudgetMs: INDEXED_SEARCH_LATENCY_BUDGET_MS,
    },
    candidates: searchDemoIndex(query),
  };

  return c.json(response);
});

app.get("/availability", (c) => {
  const artist = c.req.query("artist") ?? "";
  const track = c.req.query("track") ?? "";
  const candidate = findAvailability(artist, track);
  const response: AvailabilityResponse = {
    query: {
      artist,
      track,
      normalized: normalize(`${artist} ${track}`),
      source: "demo-index",
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
      source: "demo-index",
      latencyBudgetMs: INDEXED_SEARCH_LATENCY_BUDGET_MS,
    },
    candidate: resolveDemoUrl(url),
  };

  return c.json(response);
});

app.post("/batch", async (c) => {
  const payload = (await c.req.json().catch(() => ({}))) as { items?: BatchItem[] };
  const response: BatchResponse = {
    items: (payload.items ?? []).map((item) => {
      if (item.url) {
        const candidate = resolveDemoUrl(item.url);
        return { input: item, candidates: candidate ? [candidate] : [] };
      }

      const query = item.q ?? [item.artist, item.track].filter(Boolean).join(" ");
      return { input: item, candidates: searchDemoIndex(query) };
    }),
  };

  return c.json(response);
});

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};
