/**
 * Batch MusicBrainz ingest driver (free real-data path).
 *
 * For each curated (artist, title, scene) track:
 *   1. MB ws/2 recording search (1 rps, meaningful UA) → best candidate MBID
 *   2. ingestMusicBrainzRecording (recording + release lookups, 1 rps each)
 *   3. Write seed JSON to data/musicbrainz/ingested/{seed-id}.json
 *
 * All calls share ONE rate limiter → serialized, policy-compliant.
 * Output seeds are `api_retrieved` — human review required before promotion
 * to hand-verified golden candidates.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_USER_AGENT,
  fetchMusicBrainzJson,
  ingestMusicBrainzRecording,
  MusicBrainzRateLimiter,
  slugifySeedId,
} from "./ingest-musicbrainz";

interface CuratedTrack {
  artist: string;
  title: string;
  scene: "korea" | "japan" | "internet";
}

const CURATED_TRACKS: CuratedTrack[] = [
  // korea — K-pop/indie/electronic anchors with solid MusicBrainz coverage
  { artist: "NewJeans", title: "Hype Boy", scene: "korea" },
  { artist: "NewJeans", title: "Attention", scene: "korea" },
  { artist: "BTS", title: "Dynamite", scene: "korea" },
  { artist: "BLACKPINK", title: "DDU-DU DDU-DU", scene: "korea" },
  { artist: "IU", title: "Celebrity", scene: "korea" },
  { artist: "AKMU", title: "How can I love the heartbreak, you're the one I love", scene: "korea" },
  { artist: "Epik High", title: "Born Hater", scene: "korea" },
  { artist: "Balming Tiger", title: "Armadillo", scene: "korea" },
  { artist: "Yerin Baek", title: "Square", scene: "korea" },
  { artist: "Heize", title: "You, Clouds, Rain", scene: "korea" },
  { artist: "SE SO NEON", title: "A Long Dream", scene: "korea" },
  { artist: "The Black Skirts", title: "Everything", scene: "korea" },
  { artist: "HYUKOH", title: "TOMBOY", scene: "korea" },
  { artist: "Silica Gel", title: "Desert Eagle", scene: "korea" },
  { artist: "Neon Bunny", title: "Seoul", scene: "korea" },
  { artist: "Yaeji", title: "Raingurl", scene: "korea" },
  // japan — city pop + modern J-pop
  { artist: "Tatsuro Yamashita", title: "Sparkle", scene: "japan" },
  { artist: "Tatsuro Yamashita", title: "Ride on Time", scene: "japan" },
  { artist: "Anri", title: "Last Summer Whisper", scene: "japan" },
  { artist: "Miki Matsubara", title: "Stay with Me", scene: "japan" },
  { artist: "Junko Ohashi", title: "Telephone Number", scene: "japan" },
  { artist: "Taeko Onuki", title: "4:00 AM", scene: "japan" },
  { artist: "Tomoko Aran", title: "Midnight Pretenders", scene: "japan" },
  { artist: "Hikaru Utada", title: "First Love", scene: "japan" },
  { artist: "Kenshi Yonezu", title: "Lemon", scene: "japan" },
  { artist: "Fujii Kaze", title: "Shinunoga E-Wa", scene: "japan" },
  { artist: "YOASOBI", title: "Yoru ni Kakeru", scene: "japan" },
  { artist: "King Gnu", title: "Hakujitsu", scene: "japan" },
  { artist: "RADWIMPS", title: "Zenzenzense", scene: "japan" },
  { artist: "Ado", title: "Odo", scene: "japan" },
  // internet — hyperpop/scene/electronic anchors
  { artist: "100 gecs", title: "money machine", scene: "internet" },
  { artist: "SOPHIE", title: "Immaterial", scene: "internet" },
  { artist: "A.G. Cook", title: "Beautiful", scene: "internet" },
  { artist: "Hannah Diamond", title: "Fade away", scene: "internet" },
  { artist: "Bladee", title: "Be Nice 2 Me", scene: "internet" },
  { artist: "Yung Lean", title: "Kyoto", scene: "internet" },
  { artist: "underscores", title: "Del mar county fairgrounds 2008", scene: "internet" },
  { artist: "glaive", title: "i wanna slam my head against the wall", scene: "internet" },
  { artist: "Dorian Electra", title: "Flamboyant", scene: "internet" },
  { artist: "Kero Kero Bonito", title: "Flamingo", scene: "internet" },
  { artist: "Black Dresses", title: "Creep U", scene: "internet" },
  { artist: "Rina Sawayama", title: "XS", scene: "internet" },
  { artist: "Aphex Twin", title: "Windowlicker", scene: "internet" },
  { artist: "Boards of Canada", title: "Roygbiv", scene: "internet" },
  { artist: "Burial", title: "Archangel", scene: "internet" },
  { artist: "Oneohtrix Point Never", title: "Sticky Drama", scene: "internet" },
];

const SEARCH_URL = (artist: string, title: string) =>
  `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(
    `recording:"${title}" AND artist:"${artist}"`,
  )}&limit=5&fmt=json`;

const OUT_DIR = fileURLToPath(new URL("../data/musicbrainz/ingested", import.meta.url));

interface SearchResponse {
  recordings?: Array<{ id: string; title: string; score?: number }>;
}

function pickBestMatch(
  response: SearchResponse,
  artist: string,
  title: string,
): string | null {
  const recordings = response.recordings ?? [];
  if (recordings.length === 0) {
    return null;
  }
  // Score already computed by MB search; take the top result.
  return recordings[0]?.id ?? null;
}

const rateLimiter = new MusicBrainzRateLimiter(1000);
const results: Array<{ track: CuratedTrack; status: string; seedId?: string; error?: string }> = [];

mkdirSync(OUT_DIR, { recursive: true });

for (const track of CURATED_TRACKS) {
  try {
    const search = await fetchMusicBrainzJson<SearchResponse>(
      SEARCH_URL(track.artist, track.title),
      {
        fetchFn: fetch,
        userAgent: DEFAULT_USER_AGENT,
        rateLimiter,
      },
    );

    const recordingMbid = pickBestMatch(search, track.artist, track.title);
    if (!recordingMbid) {
      results.push({ track, status: "no_match" });
      continue;
    }

    const seed = await ingestMusicBrainzRecording({
      recordingMbid,
      artistHint: track.artist,
      titleHint: track.title,
      seedId: slugifySeedId(track.artist, track.title),
    });

    const outPath = `${OUT_DIR}/${seed.seed_id}.json`;
    writeFileSync(outPath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
    results.push({ track, status: "ingested", seedId: seed.seed_id });
  } catch (error) {
    results.push({
      track,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

console.log(
  JSON.stringify(
    {
      total: CURATED_TRACKS.length,
      ingested: results.filter((r) => r.status === "ingested").length,
      no_match: results.filter((r) => r.status === "no_match").length,
      errors: results.filter((r) => r.status === "error").length,
      details: results,
    },
    null,
    2,
  ),
);
