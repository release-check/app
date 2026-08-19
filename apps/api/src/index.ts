import { Hono } from "hono";
import { cors } from "hono/cors";
import { matchWithRustCore, type CoreMatchInput } from "./core-bridge";
import { normalize } from "./demo-index";
import {
  findIndexedAvailability,
  getSearchIndexStats,
  resolveIndexedUrl,
  searchReleaseIndex,
  suggestReleaseIndex,
} from "./search-index";
import {
  addSubmission,
  getDb,
  listSubmissions,
  updateSubmissionStatus,
} from "./storage";
import { liveLookup, liveLookupCooldownRemainingMs } from "./live-lookup";
import type {
  AvailabilityResponse,
  BatchItem,
  BatchResponse,
  ResolveResponse,
  SearchResponse,
} from "./types";
import { PLATFORMS } from "./types";

const app = new Hono();
const INDEXED_SEARCH_LATENCY_BUDGET_MS = 150;

app.use("*", cors());

app.post("/submissions", async (c) => {
  const database = getDb();
  if (!database) {
    return c.json(
      { error: "persistence disabled — set RELEASE_CHECK_DB to accept submissions" },
      503,
    );
  }

  const body = (await c.req.json().catch(() => null)) as
    | { artist?: unknown; title?: unknown; platform?: unknown; url?: unknown; note?: unknown }
    | null;
  if (!body) {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  if (typeof body.artist !== "string" || typeof body.title !== "string") {
    return c.json({ error: "artist and title (strings) are required" }, 400);
  }
  if (typeof body.platform !== "string" || !(PLATFORMS as readonly string[]).includes(body.platform)) {
    return c.json({ error: `platform must be one of: ${PLATFORMS.join(", ")}` }, 400);
  }
  if (typeof body.url !== "string" || !/^https?:\/\//.test(body.url)) {
    return c.json({ error: "url must be an http(s) link" }, 400);
  }

  const submission = addSubmission(database, {
    artist: body.artist.trim(),
    title: body.title.trim(),
    platform: body.platform as (typeof PLATFORMS)[number],
    url: body.url.trim(),
    note: typeof body.note === "string" ? body.note.trim() : null,
  });
  return c.json({ submission }, 201);
});

app.get("/submissions", (c) => {
  const database = getDb();
  if (!database) {
    return c.json({ error: "persistence disabled" }, 503);
  }
  const status = c.req.query("status");
  return c.json({ submissions: listSubmissions(database, status) });
});

app.post("/submissions/:id/verify", async (c) => {
  const database = getDb();
  if (!database) {
    return c.json({ error: "persistence disabled" }, 503);
  }
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) {
    return c.json({ error: "invalid submission id" }, 400);
  }
  const updated = updateSubmissionStatus(database, id, "verified");
  if (!updated) {
    return c.json({ error: "submission not found" }, 404);
  }
  return c.json({ submission: updated });
});

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

app.get("/search", async (c) => {
  const query = c.req.query("q") ?? "";
  const indexed = searchReleaseIndex(query).slice(0, 10);

  let candidates = indexed;
  let liveLookupNote: string | undefined;

  const [artist, title] = splitQuery(query);
  const exactMatch = artist && title ? findIndexedAvailability(artist, title) : null;
  const hasRealCandidate = indexed.some(
    (candidate) => candidate.sample?.origin !== "synthetic_load",
  );

  // Live recovery only when the index has nothing real: no exact match and
  // only synthetic/noise candidates (or nothing) ranked.
  if (!exactMatch && !hasRealCandidate && artist && title) {
    const live = await liveLookup(artist, title);
    if (live.length > 0) {
      candidates = [...live, ...indexed];
      liveLookupNote = `live iTunes lookup returned ${live.length} unverified candidate(s)`;
    } else if (liveLookupCooldownRemainingMs() > 0) {
      liveLookupNote = "live lookup on cooldown — try again shortly";
    }
  }

  const response: SearchResponse = {
    query: {
      q: query,
      normalized: normalize(query),
      source: responseIndexSource(),
      latencyBudgetMs: INDEXED_SEARCH_LATENCY_BUDGET_MS,
      liveLookup: liveLookupNote,
    },
    candidates: candidates.slice(0, 10).map((candidate) => ({
      ...candidate,
      ...(candidate.sample?.origin ? { origin: candidate.sample.origin } : {}),
    })),
  };

  return c.json(response);
});

function splitQuery(query: string): [string, string] {
  const parts = query.trim().split(/\s+/);
  if (parts.length < 2) {
    return ["", ""];
  }
  // Heuristic: last token = title, the rest = artist.
  const title = parts[parts.length - 1]!;
  const artist = parts.slice(0, -1).join(" ");
  return [artist, title];
}

app.get("/suggest", (c) => {
  const query = c.req.query("q") ?? "";
  return c.json({
    query: {
      q: query,
      normalized: normalize(query),
      source: responseIndexSource(),
    },
    suggestions: suggestReleaseIndex(query),
  });
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
