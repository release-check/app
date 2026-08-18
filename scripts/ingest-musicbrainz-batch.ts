/**
 * Batch MusicBrainz ingest driver (free real-data path) — v2.
 *
 * For each curated (artist, title, scene) track:
 *   1. MB ws/2 recording search (1 rps, meaningful UA) — primary query, then
 *      original-language variant if configured and the primary misses
 *   2. ingestMusicBrainzRecording (recording + release lookups, 1 rps each)
 *   3. Write seed JSON to data/musicbrainz/ingested/{seed-id}.json
 *
 * Tracks whose seed file already exists are skipped (resume-safe).
 * All calls share ONE rate limiter → serialized, policy-compliant.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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
  /** original-language fallback search (Hangul/Kanji) */
  artistAlt?: string;
  titleAlt?: string;
}

const CURATED_TRACKS: CuratedTrack[] = [
  // --- korea ---
  { artist: "NewJeans", title: "Hype Boy", scene: "korea" },
  { artist: "NewJeans", title: "Attention", scene: "korea" },
  { artist: "BTS", title: "Dynamite", scene: "korea" },
  { artist: "BLACKPINK", title: "DDU-DU DDU-DU", scene: "korea" },
  { artist: "IU", title: "Celebrity", scene: "korea" },
  { artist: "AKMU", title: "How can I love the heartbreak, you're the one I love", scene: "korea" },
  { artist: "Epik High", title: "Born Hater", scene: "korea" },
  { artist: "Balming Tiger", title: "Armadillo", scene: "korea" },
  { artist: "Yerin Baek", title: "Square", scene: "korea" },
  { artist: "Heize", title: "You, Clouds, Rain", scene: "korea", artistAlt: "헤이즈", titleAlt: "너, 구름, 비" },
  { artist: "SE SO NEON", title: "A Long Dream", scene: "korea", artistAlt: "새소년", titleAlt: "긴 꿈" },
  { artist: "The Black Skirts", title: "Everything", scene: "korea", artistAlt: "검정치마" },
  { artist: "HYUKOH", title: "TOMBOY", scene: "korea" },
  { artist: "Silica Gel", title: "Desert Eagle", scene: "korea" },
  { artist: "Neon Bunny", title: "Seoul", scene: "korea" },
  { artist: "Yaeji", title: "Raingurl", scene: "korea" },
  { artist: "LE SSERAFIM", title: "Antifragile", scene: "korea" },
  { artist: "IVE", title: "I AM", scene: "korea" },
  { artist: "aespa", title: "Next Level", scene: "korea" },
  { artist: "Zico", title: "Any Song", scene: "korea" },
  { artist: "Crush", title: "Rush Hour", scene: "korea" },
  { artist: "JANNABI", title: "for lovers who hesitate", scene: "korea" },
  { artist: "Say Sue Me", title: "Old Town", scene: "korea" },
  // --- japan ---
  { artist: "Tatsuro Yamashita", title: "Sparkle", scene: "japan", artistAlt: "山下達郎" },
  { artist: "Tatsuro Yamashita", title: "Ride on Time", scene: "japan", artistAlt: "山下達郎" },
  { artist: "Anri", title: "Last Summer Whisper", scene: "japan", artistAlt: "杏里" },
  { artist: "Miki Matsubara", title: "Stay with Me", scene: "japan", artistAlt: "松原みき", titleAlt: "真夜中のドア〜stay with me" },
  { artist: "Junko Ohashi", title: "Telephone Number", scene: "japan", artistAlt: "大橋純子", titleAlt: "テレフォン・ナンバー" },
  { artist: "Taeko Onuki", title: "4:00 AM", scene: "japan", artistAlt: "大貫妙子" },
  { artist: "Tomoko Aran", title: "Midnight Pretenders", scene: "japan", artistAlt: "亜蘭知子" },
  { artist: "Hikaru Utada", title: "First Love", scene: "japan", artistAlt: "宇多田ヒカル" },
  { artist: "Kenshi Yonezu", title: "Lemon", scene: "japan", artistAlt: "米津玄師" },
  { artist: "Kenshi Yonezu", title: "KICK BACK", scene: "japan", artistAlt: "米津玄師" },
  { artist: "Fujii Kaze", title: "Shinunoga E-Wa", scene: "japan", artistAlt: "藤井風", titleAlt: "死ぬのがいいわ" },
  { artist: "YOASOBI", title: "Yoru ni Kakeru", scene: "japan", titleAlt: "夜に駆ける" },
  { artist: "King Gnu", title: "Hakujitsu", scene: "japan", titleAlt: "白日" },
  { artist: "RADWIMPS", title: "Zenzenzense", scene: "japan", titleAlt: "前前前世" },
  { artist: "Ado", title: "Odo", scene: "japan", titleAlt: "うっせぇわ" },
  { artist: "Official HIGE DANdism", title: "Pretender", scene: "japan", artistAlt: "Official髭男dism" },
  { artist: "Aimer", title: "Zankyosanka", scene: "japan", titleAlt: "残響散歌" },
  // --- internet ---
  { artist: "100 gecs", title: "money machine", scene: "internet" },
  { artist: "100 gecs", title: "stupid horse", scene: "internet" },
  { artist: "SOPHIE", title: "Immaterial", scene: "internet" },
  { artist: "SOPHIE", title: "Faceshopping", scene: "internet" },
  { artist: "A.G. Cook", title: "Beautiful", scene: "internet" },
  { artist: "Hannah Diamond", title: "Fade away", scene: "internet" },
  { artist: "Bladee", title: "Be Nice 2 Me", scene: "internet" },
  { artist: "Yung Lean", title: "Kyoto", scene: "internet" },
  { artist: "Yung Lean", title: "Ginseng Strip 2002", scene: "internet" },
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
  { artist: "Charli XCX", title: "1999", scene: "internet" },
  { artist: "Caroline Polachek", title: "So Hot You're Hurting My Feelings", scene: "internet" },
  { artist: "Ecco2k", title: "Time", scene: "internet" },
  { artist: "Alice Longyu Gao", title: "Rich Bitch Juice", scene: "internet" },
];

const SEARCH_URL = (artist: string, title: string) =>
  `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(
    `recording:"${title}" AND artist:"${artist}"`,
  )}&limit=5&fmt=json`;

const OUT_DIR = fileURLToPath(new URL("../data/musicbrainz/ingested", import.meta.url));

interface SearchResponse {
  recordings?: Array<{ id: string; title: string; score?: number }>;
}

async function searchBestMbid(track: CuratedTrack, rateLimiter: MusicBrainzRateLimiter): Promise<string | null> {
  const queries: Array<[string, string]> = [[track.artist, track.title]];
  if (track.artistAlt && track.titleAlt) {
    queries.push([track.artistAlt, track.titleAlt]);
  } else if (track.artistAlt) {
    queries.push([track.artistAlt, track.title]);
  } else if (track.titleAlt) {
    queries.push([track.artist, track.titleAlt]);
  }

  for (const [artist, title] of queries) {
    const response = await fetchMusicBrainzJson<SearchResponse>(SEARCH_URL(artist, title), {
      fetchFn: fetch,
      userAgent: DEFAULT_USER_AGENT,
      rateLimiter,
    });
    if ((response.recordings?.length ?? 0) > 0) {
      return response.recordings![0]!.id;
    }
  }
  return null;
}

const rateLimiter = new MusicBrainzRateLimiter(1000);
const results: Array<{ track: CuratedTrack; status: string; seedId?: string; error?: string }> = [];

mkdirSync(OUT_DIR, { recursive: true });

for (const track of CURATED_TRACKS) {
  const seedId = slugifySeedId(track.artist, track.title);
  if (existsSync(`${OUT_DIR}/${seedId}.json`)) {
    results.push({ track, status: "exists", seedId });
    continue;
  }

  try {
    const recordingMbid = await searchBestMbid(track, rateLimiter);
    if (!recordingMbid) {
      results.push({ track, status: "no_match" });
      continue;
    }

    const seed = await ingestMusicBrainzRecording({
      recordingMbid,
      artistHint: track.artist,
      titleHint: track.title,
      seedId,
    });

    writeFileSync(`${OUT_DIR}/${seedId}.json`, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
    results.push({ track, status: "ingested", seedId });
  } catch (error) {
    results.push({
      track,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const summary = (status: string) =>
  results.filter((r) => r.status === status).map((r) => `${r.track.artist} - ${r.track.title}`);

console.log(
  JSON.stringify(
    {
      total: CURATED_TRACKS.length,
      ingested: summary("ingested").length,
      exists: summary("exists").length,
      no_match: summary("no_match").length,
      errors: summary("error").length,
      ingested_tracks: summary("ingested"),
      no_match_tracks: summary("no_match"),
      error_tracks: results.filter((r) => r.status === "error").map((r) => `${r.track.artist} - ${r.track.title} (${r.error})`),
    },
    null,
    2,
  ),
);
