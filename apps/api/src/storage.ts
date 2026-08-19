/**
 * SQLite persistence layer (real-use path).
 *
 * Active only when RELEASE_CHECK_DB is set (or the DB file already exists).
 * When inactive, all functions no-op so fixture-based tests and the demo
 * path keep working unchanged.
 *
 * Schema:
 * - tracks: candidate identity + scoring metadata
 * - availability: per-track per-platform state/url (golden/ingested source)
 * - submissions: community link submissions (pending -> verified/rejected)
 */
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { DEMO_INDEX } from "./demo-index";
import { VERIFIED_INDEX } from "./verified-index";
import { VERIFIED_INGESTED } from "./verified-ingested";
import type { AvailabilityEntry, Candidate, Platform } from "./types";
import { PLATFORMS } from "./types";

const DEFAULT_DB_PATH = fileURLToPath(new URL("../../data/releasecheck.db", import.meta.url));

export interface Submission {
  id: number;
  artist: string;
  title: string;
  platform: Platform;
  url: string;
  note: string | null;
  status: "pending" | "verified" | "rejected";
  created_at: string;
  verified_at: string | null;
}

type SqlParam = string | number | null;
function prefixParams<T extends Record<string, SqlParam>>(
  params: T,
): { [K in keyof T as `$${string & K}`]: T[K] } {
  const out = {} as Record<string, SqlParam>;
  for (const [key, value] of Object.entries(params)) {
    out[`$${key}`] = value;
  }
  return out as { [K in keyof T as `$${string & K}`]: T[K] };
}

function isDbActive(): boolean {
  return Boolean(process.env.RELEASE_CHECK_DB) || existsSync(DEFAULT_DB_PATH);
}

let db: Database | null | undefined;

export function getDb(): Database | null {
  if (db !== undefined) {
    return db;
  }
  if (!isDbActive()) {
    db = null;
    return null;
  }
  const path = process.env.RELEASE_CHECK_DB || DEFAULT_DB_PATH;
  db = new Database(path, { create: true });
  migrate(db);
  return db;
}

export function migrate(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      artist TEXT NOT NULL,
      title TEXT NOT NULL,
      release TEXT,
      duration_seconds INTEGER,
      isrc TEXT,
      recording_mbid TEXT,
      scene TEXT NOT NULL,
      origin TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      messy INTEGER NOT NULL DEFAULT 0,
      confidence REAL NOT NULL,
      ambiguity TEXT NOT NULL DEFAULT '[]',
      evidence TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS availability (
      track_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      state TEXT NOT NULL,
      url TEXT,
      note TEXT,
      source TEXT,
      fetched_at TEXT,
      PRIMARY KEY (track_id, platform),
      FOREIGN KEY (track_id) REFERENCES tracks(id)
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist TEXT NOT NULL,
      title TEXT NOT NULL,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      verified_at TEXT
    );
  `);
}

function candidateToRow(candidate: Candidate): Record<string, string | number | null> {
  return {
    id: candidate.id,
    artist: candidate.canonical.artist,
    title: candidate.canonical.title,
    release: candidate.canonical.release ?? null,
    duration_seconds: candidate.canonical.durationSeconds ?? null,
    isrc: candidate.canonical.isrc ?? null,
    recording_mbid:
      candidate.evidence.find((e) => e.field === "musicbrainz")?.note.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
      )?.[0] ?? null,
    scene: candidate.sample?.scene ?? "demo",
    origin: candidate.sample?.origin ?? "handwritten_demo",
    verified: candidate.sample?.verified ? 1 : 0,
    messy: candidate.sample?.messyCase ? 1 : 0,
    confidence: candidate.confidence,
    ambiguity: JSON.stringify(candidate.ambiguity),
    evidence: JSON.stringify(candidate.evidence),
    created_at: new Date().toISOString(),
  };
}

function rowToCandidate(row: {
  id: string;
  artist: string;
  title: string;
  release: string | null;
  duration_seconds: number | null;
  isrc: string | null;
  scene: string;
  origin: string;
  verified: number;
  messy: number;
  confidence: number;
  ambiguity: string;
  evidence: string;
}, availability: Partial<Record<Platform, AvailabilityEntry>>): Candidate {
  const availabilityMap = {} as Record<Platform, AvailabilityEntry>;
  for (const platform of PLATFORMS) {
    availabilityMap[platform] = availability[platform] ?? { state: "unknown", note: "not indexed" };
  }
  return {
    id: row.id,
    canonical: {
      artist: row.artist,
      title: row.title,
      release: row.release ?? undefined,
      durationSeconds: row.duration_seconds ?? undefined,
      isrc: row.isrc ?? undefined,
    },
    confidence: row.confidence,
    ambiguity: JSON.parse(row.ambiguity) as string[],
    evidence: JSON.parse(row.evidence) as Candidate["evidence"],
    availability: availabilityMap,
    sample: {
      origin: row.origin as Candidate["sample"] extends infer S ? (S extends { origin: infer O } ? O : never) : never,
      scene: row.scene,
      messyCase: Boolean(row.messy),
      verified: Boolean(row.verified),
    },
  };
}

/** Bootstraps the fixture catalog (demo + verified + ingested + golden availability) into the DB. */
export function bootstrapFromFixtures(database: Database): number {
  const existing = database.query("SELECT COUNT(*) AS n FROM tracks").get() as { n: number };
  if (existing.n > 0) {
    return existing.n;
  }

  const insertTrack = database.prepare(`
    INSERT OR REPLACE INTO tracks (
      id, artist, title, release, duration_seconds, isrc, recording_mbid,
      scene, origin, verified, messy, confidence, ambiguity, evidence, created_at
    ) VALUES (
      $id, $artist, $title, $release, $duration_seconds, $isrc, $recording_mbid,
      $scene, $origin, $verified, $messy, $confidence, $ambiguity, $evidence, $created_at
    )
  `);
  const insertAvailability = database.prepare(`
    INSERT OR REPLACE INTO availability (track_id, platform, state, url, note, source, fetched_at)
    VALUES ($track_id, $platform, $state, $url, $note, $source, $fetched_at)
  `);

  const candidates = [...DEMO_INDEX, ...VERIFIED_INDEX, ...VERIFIED_INGESTED];
  const upsert = database.transaction((rows: Candidate[]) => {
    for (const candidate of rows) {
      insertTrack.run(prefixParams(candidateToRow(candidate)));
      for (const [platform, entry] of Object.entries(candidate.availability)) {
        insertAvailability.run(
          prefixParams({
            track_id: candidate.id,
            platform,
            state: entry.state,
            url: entry.url ?? null,
            note: entry.note ?? null,
            source: entry.source ?? null,
            fetched_at: entry.cachedAt ?? null,
          }),
        );
      }
    }
  });
  upsert(candidates);

  return candidates.length;
}

/** Loads all candidates (tracks + availability) from the DB. */
export function loadCandidates(database: Database): Candidate[] {
  const tracks = database
    .query(
      `SELECT id, artist, title, release, duration_seconds, isrc, scene, origin,
              verified, messy, confidence, ambiguity, evidence
       FROM tracks ORDER BY id`,
    )
    .all() as Array<{
    id: string;
    artist: string;
    title: string;
    release: string | null;
    duration_seconds: number | null;
    isrc: string | null;
    scene: string;
    origin: string;
    verified: number;
    messy: number;
    confidence: number;
    ambiguity: string;
    evidence: string;
  }>;
  const availability = database
    .query(`SELECT track_id, platform, state, url, note, source, fetched_at FROM availability`)
    .all() as Array<{
    track_id: string;
    platform: string;
    state: string;
    url: string | null;
    note: string | null;
    source: string | null;
    fetched_at: string | null;
  }>;

  const byTrack = new Map<string, Partial<Record<Platform, AvailabilityEntry>>>();
  for (const row of availability) {
    const map = byTrack.get(row.track_id) ?? {};
    map[row.platform as Platform] = {
      state: row.state as AvailabilityEntry["state"],
      url: row.url ?? undefined,
      note: row.note ?? undefined,
      source: row.source ?? undefined,
      cachedAt: row.fetched_at ?? undefined,
    };
    byTrack.set(row.track_id, map);
  }

  return tracks.map((row) => rowToCandidate(row, byTrack.get(row.id) ?? {}));
}

/** Upserts one platform availability entry for a track. */
export function upsertAvailability(
  database: Database,
  trackId: string,
  platform: Platform,
  entry: AvailabilityEntry,
): void {
  database
    .prepare(
      `INSERT OR REPLACE INTO availability (track_id, platform, state, url, note, source, fetched_at)
       VALUES ($track_id, $platform, $state, $url, $note, $source, $fetched_at)`,
    )
    .run(
      prefixParams({
        track_id: trackId,
        platform,
        state: entry.state,
        url: entry.url ?? null,
        note: entry.note ?? null,
        source: entry.source ?? null,
        fetched_at: entry.cachedAt ?? new Date().toISOString(),
      }),
    );
}

export function addSubmission(
  database: Database,
  submission: Omit<Submission, "id" | "status" | "created_at" | "verified_at">,
): Submission {
  const createdAt = new Date().toISOString();
  const result = database
    .prepare(
      `INSERT INTO submissions (artist, title, platform, url, note, status, created_at)
       VALUES ($artist, $title, $platform, $url, $note, 'pending', $created_at)`,
    )
    .run(
      prefixParams({
        artist: submission.artist,
        title: submission.title,
        platform: submission.platform,
        url: submission.url,
        note: submission.note ?? null,
        created_at: createdAt,
      }),
    );
  const id = Number(result.lastInsertRowid);
  return { id, ...submission, status: "pending", created_at: createdAt, verified_at: null };
}

export function listSubmissions(database: Database, status?: string): Submission[] {
  if (status) {
    return database
      .prepare(`SELECT * FROM submissions WHERE status = $status ORDER BY id DESC`)
      .all(prefixParams({ status })) as Submission[];
  }
  return database.prepare(`SELECT * FROM submissions ORDER BY id DESC`).all() as Submission[];
}

export function updateSubmissionStatus(
  database: Database,
  id: number,
  status: Submission["status"],
): Submission | null {
  database
    .prepare(`UPDATE submissions SET status = $status, verified_at = $verified_at WHERE id = $id`)
    .run(
      prefixParams({
        id,
        status,
        verified_at: status === "pending" ? null : new Date().toISOString(),
      }),
    );
  return database.prepare(`SELECT * FROM submissions WHERE id = $id`).get({ $id: id }) as
    | Submission
    | null;
}
