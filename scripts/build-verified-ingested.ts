/**
 * Generates apps/api/src/verified-ingested.ts from data/musicbrainz/ingested/*.json
 * (api_retrieved seeds — NOT hand-verified; sample.verified=false).
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Candidate } from "../apps/api/src/types";

const INGESTED_DIR = fileURLToPath(new URL("../data/musicbrainz/ingested", import.meta.url));
const OUT_PATH = fileURLToPath(new URL("../apps/api/src/verified-ingested.ts", import.meta.url));

const SCENE_MAP: Record<string, string> = {
  "mb-ingest-akmu-how-can-i-love-the-heartbreak-you-re-the-on": "korea",
  "mb-ingest-balming-tiger-armadillo": "korea",
  "mb-ingest-blackpink-ddu-du-ddu-du": "korea",
  "mb-ingest-bts-dynamite": "korea",
  "mb-ingest-epik-high-born-hater": "korea",
  "mb-ingest-hyukoh-tomboy": "korea",
  "mb-ingest-iu-celebrity": "korea",
  "mb-ingest-neon-bunny-seoul": "korea",
  "mb-ingest-newjeans-attention": "korea",
  "mb-ingest-newjeans-hype-boy": "korea",
  "mb-ingest-silica-gel-desert-eagle": "korea",
  "mb-ingest-yerin-baek-square": "korea",
  "mb-ingest-aespa-next-level": "korea",
  "mb-ingest-ive-i-am": "korea",
  "mb-ingest-le-sserafim-antifragile": "korea",
  "mb-ingest-say-sue-me-old-town": "korea",
  "mb-ingest-se-so-neon-a-long-dream": "korea",
  "mb-ingest-the-black-skirts-everything": "korea",
  "mb-ingest-zico-any-song": "korea",
  "mb-ingest-ado-odo": "japan",
  "mb-ingest-hikaru-utada-first-love": "japan",
  "mb-ingest-miki-matsubara-stay-with-me": "japan",
  "mb-ingest-radwimps-zenzenzense": "japan",
  "mb-ingest-tomoko-aran-midnight-pretenders": "japan",
  "mb-ingest-aimer-zankyosanka": "japan",
  "mb-ingest-anri-last-summer-whisper": "japan",
  "mb-ingest-fujii-kaze-shinunoga-e-wa": "japan",
  "mb-ingest-junko-ohashi-telephone-number": "japan",
  "mb-ingest-kenshi-yonezu-lemon": "japan",
  "mb-ingest-king-gnu-hakujitsu": "japan",
  "mb-ingest-official-hige-dandism-pretender": "japan",
  "mb-ingest-tatsuro-yamashita-sparkle": "japan",
  "mb-ingest-yoasobi-yoru-ni-kakeru": "japan",
  "mb-ingest-black-dresses-creep-u": "internet",
  "mb-ingest-burial-archangel": "internet",
  "mb-ingest-dorian-electra-flamboyant": "internet",
  "mb-ingest-glaive-i-wanna-slam-my-head-against-the-wall": "internet",
  "mb-ingest-hannah-diamond-fade-away": "internet",
  "mb-ingest-kero-kero-bonito-flamingo": "internet",
  "mb-ingest-oneohtrix-point-never-sticky-drama": "internet",
  "mb-ingest-rina-sawayama-xs": "internet",
  "mb-ingest-sophie-immaterial": "internet",
  "mb-ingest-yung-lean-kyoto": "internet",
  "mb-ingest-alice-longyu-gao-rich-bitch-juice": "internet",
  "mb-ingest-aphex-twin-windowlicker": "internet",
  "mb-ingest-boards-of-canada-roygbiv": "internet",
  "mb-ingest-caroline-polachek-so-hot-you-re-hurting-my-feeli": "internet",
  "mb-ingest-ecco2k-time": "internet",
  "mb-ingest-sophie-faceshopping": "internet",
  "mb-ingest-yung-lean-ginseng-strip-2002": "internet",
};

interface IngestedSeed {
  seed_id: string;
  identity: { recording_mbid: string };
  metadata: {
    title: string;
    artist_credit: string;
    release_title: string;
    duration_ms: number;
    isrcs: string[];
  };
}

const seeds = readdirSync(INGESTED_DIR)
  .filter((name) => name.endsWith(".json"))
  .map((name) => JSON.parse(readFileSync(`${INGESTED_DIR}/${name}`, "utf8")) as IngestedSeed)
  .sort((a, b) => a.seed_id.localeCompare(b.seed_id));

const unknownAvailability = (
  scene: string,
): Candidate["availability"] => ({
  spotify: { state: "unknown", note: "platform availability not yet verified" },
  youtube_music: { state: "unknown", note: "platform availability not yet verified" },
  apple_music: { state: "unknown", note: "platform availability not yet verified" },
  soundcloud: { state: "unknown", note: "platform availability not yet verified" },
  bandcamp: { state: "unknown", note: "platform availability not yet verified" },
  melon: {
    state: "unknown",
    note: `regional catalog availability not verified (scene: ${scene})`,
  },
});

const candidates: Candidate[] = seeds.map((seed) => {
  const scene = SCENE_MAP[seed.seed_id] ?? "internet";
  return {
    id: seed.seed_id,
    canonical: {
      artist: seed.metadata.artist_credit,
      title: seed.metadata.title,
      release: seed.metadata.release_title,
      durationSeconds: Math.round(seed.metadata.duration_ms / 1000),
      isrc: seed.metadata.isrcs[0],
    },
    confidence: 0.85,
    ambiguity: [],
    evidence: [
      { field: "artist", score: 1, note: "artist credit from MusicBrainz ws/2" },
      { field: "title", score: 1, note: "title from MusicBrainz ws/2 recording lookup" },
      { field: "duration", score: 0.9, note: "duration from MusicBrainz recording" },
      {
        field: "musicbrainz",
        score: 1,
        note: `recording ${seed.identity.recording_mbid} api_retrieved (not hand-verified)`,
      },
    ],
    availability: unknownAvailability(scene),
    sample: {
      origin: "musicbrainz_ingested",
      scene,
      messyCase: false,
      verified: false,
    },
  };
});

const header = `// Generated by scripts/build-verified-ingested.ts — do not edit by hand.
// Sources: data/musicbrainz/ingested/*.json (api_retrieved, CC0 core metadata).
// These candidates are NOT hand-verified; sample.verified=false.
import type { Candidate } from "./types";

export const VERIFIED_INGESTED: Candidate[] = `;

writeFileSync(OUT_PATH, `${header}${JSON.stringify(candidates, null, 2)};\n`, "utf8");
console.log(
  JSON.stringify({ out: OUT_PATH, candidateCount: candidates.length, scenes: Object.values(SCENE_MAP).reduce<Record<string, number>>((acc, s) => { acc[s] = (acc[s] ?? 0) + 1; return acc; }, {}) }, null, 2),
);
