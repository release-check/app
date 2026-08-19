/**
 * Request-path live lookup (miss recovery) — Apple Music via iTunes Search API.
 *
 * Policy: NO fan-out in the request path as a default (AGENTS rule). This
 * module runs ONLY when a search returns zero candidates, is limited to the
 * single free official API (iTunes), paced globally (1 lookup / 15s), and
 * every synthesized candidate is marked unverified with a low confidence.
 *
 * Results persist so a second identical query hits the index instead.
 */
import { ITunesAdapter, type AdapterSnapshot } from "./adapters";
import { normalize } from "./demo-index";
import { getDb, upsertAvailability } from "./storage";
import type { Candidate, Platform } from "./types";

const LIVE_LOOKUP_INTERVAL_MS = 15_000;
const LIVE_LOOKUP_CONFIDENCE = 0.6;

let lastLookupAt = 0;
let inflight: Promise<Candidate[]> | null = null;

const itunes = new ITunesAdapter();

function liveCandidate(
  artist: string,
  title: string,
  snapshot: AdapterSnapshot,
): Candidate {
  const note = snapshot.note ?? "iTunes search result";
  const [snapshotArtist, snapshotTitle] = note.split(" — ");
  return {
    id: `live-${normalize(artist)}-${normalize(title)}`.replace(/\s+/g, "-").slice(0, 80),
    canonical: {
      artist: snapshotArtist ?? artist,
      title: snapshotTitle ?? title,
      release: undefined,
      durationSeconds: undefined,
      isrc: undefined,
    },
    confidence: LIVE_LOOKUP_CONFIDENCE,
    ambiguity: [],
    evidence: [
      { field: "artist", score: 0.7, note: "unverified iTunes search result" },
      { field: "title", score: 0.7, note: "unverified iTunes search result" },
      {
        field: "musicbrainz",
        score: 0,
        note: "no MusicBrainz identity — requires verification before promotion",
      },
    ],
    availability: {
      spotify: { state: "unknown", note: "not checked" },
      youtube_music: { state: "unknown", note: "not checked" },
      apple_music: {
        state: snapshot.state as "available" | "unknown" | "missing",
        url: snapshot.url,
        note: "live iTunes lookup — unverified",
        source: "live_lookup",
        cachedAt: snapshot.fetchedAt,
      },
      soundcloud: { state: "unknown", note: "not checked" },
      bandcamp: { state: "unknown", note: "not checked" },
      melon: { state: "unknown", note: "not checked" },
    },
    sample: {
      origin: "live_lookup",
      scene: "internet",
      messyCase: true,
      verified: false,
    },
  };
}

function persistSnapshot(artist: string, title: string, snapshot: AdapterSnapshot): void {
  const database = getDb();
  if (!database) {
    return;
  }
  const id = `live-${normalize(artist)}-${normalize(title)}`.replace(/\s+/g, "-").slice(0, 80);
  upsertAvailability(database, id, "apple_music" as Platform, {
    state: snapshot.state as "available" | "unknown" | "missing",
    url: snapshot.url,
    note: "live iTunes lookup — unverified",
    source: "live_lookup",
    cachedAt: snapshot.fetchedAt,
  });
}

export function liveLookupCooldownRemainingMs(now = Date.now()): number {
  return Math.max(0, LIVE_LOOKUP_INTERVAL_MS - (now - lastLookupAt));
}

/** Test hook: clear the pacing window. */
export function _resetLiveLookupForTest(): void {
  lastLookupAt = 0;
}

export async function liveLookup(artist: string, title: string): Promise<Candidate[]> {
  if (inflight) {
    return inflight;
  }

  const now = Date.now();
  if (now - lastLookupAt < LIVE_LOOKUP_INTERVAL_MS) {
    return [];
  }
  lastLookupAt = now;

  inflight = (async () => {
    const snapshots = await itunes.lookup(artist, title);
    const candidates: Candidate[] = [];
    for (const snapshot of snapshots) {
      if (snapshot.state !== "available") {
        continue;
      }
      persistSnapshot(artist, title, snapshot);
      candidates.push(liveCandidate(artist, title, snapshot));
    }
    return candidates;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}
