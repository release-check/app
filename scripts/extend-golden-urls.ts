// Extends golden-set.json with URL-verified cases for the remaining 49
// MusicBrainz-ingested tracks (web-verified 2026-08-19).
import fs from "node:fs";
import { VERIFIED_INGESTED } from "../apps/api/src/verified-ingested.ts";

const INGESTED = "data/musicbrainz/ingested";
const SCENE_BY_ID = new Map(VERIFIED_INGESTED.map((c) => [c.id, c.sample.scene]));

// seed_id -> { spotify?, apple?, note? } — only verified URLs; others stay unknown.
const URL_MAP: Record<string, { spotify?: string; apple?: string; note?: string }> = {
  "mb-ingest-hannah-diamond-fade-away": { spotify: "https://open.spotify.com/album/3EB9EZGqj2VDbkpkWWyFpr", apple: "https://music.apple.com/us/song/1175866017", note: "spotify link album-level" },
  "mb-ingest-yerin-baek-square": { spotify: "https://open.spotify.com/track/2cTK5kS6aPYBNdhUQCzFN7", apple: "https://music.apple.com/us/song/1490544823" },
  "mb-ingest-ado-odo": { spotify: "https://open.spotify.com/track/37bNBNB332HXbSy6079cws", apple: "https://music.apple.com/us/album/odo-single/1562772199", note: "apple link album-level" },
  "mb-ingest-ive-i-am": { spotify: "https://open.spotify.com/track/70t7Q6AYG6ZgTYmJWcnkUM", apple: "https://music.apple.com/us/song/1680047366" },
  "mb-ingest-kenshi-yonezu-kick-back": { spotify: "https://open.spotify.com/track/3khEEPRyBeOUabbmOPJzAG", apple: "https://music.apple.com/us/song/1648272180" },
  "mb-ingest-yung-lean-kyoto": { spotify: "https://open.spotify.com/track/7vQ8hT2jlA6RhxI4ZxISVd", apple: "https://music.apple.com/us/song/1615432326" },
  "mb-ingest-dorian-electra-adam-steve": { spotify: "https://open.spotify.com/track/6Tvv7wIAKUcUfL05kJ6vjZ", apple: "https://music.apple.com/us/song/1464724134" },
  "mb-ingest-slayyyter-mine": { spotify: "https://open.spotify.com/track/0HMco7zpjdsloHqToLjiLK", apple: "https://music.apple.com/us/song/1478323915" },
  "mb-ingest-tommy-genesis-100-bad": { spotify: "https://open.spotify.com/track/5Q36ZTmWp2QQZnyUZLeVE9", apple: "https://music.apple.com/us/song/1669523007" },
  "mb-ingest-newjeans-attention": { spotify: "https://open.spotify.com/track/2pIUpMhHL6L9Z5lnKxJJr9", apple: "https://music.apple.com/us/song/1635469694" },
  "mb-ingest-dorian-electra-flamboyant": { spotify: "https://open.spotify.com/track/6BUJCYAqUjb6vRz3ln8a87", apple: "https://music.apple.com/us/song/1464724131" },
  "mb-ingest-kenshi-yonezu-loser": { spotify: "https://open.spotify.com/track/3kIwKukIssWZzHI9LN6Cgz", apple: "https://music.apple.com/us/song/1537279545" },
  "mb-ingest-kero-kero-bonito-flamingo": { spotify: "https://open.spotify.com/track/3AaiEsiqHO2ylnnOdWninE", apple: "https://music.apple.com/us/song/1078710004" },
  "mb-ingest-tatsuro-yamashita-sparkle": { note: "original not available on US Spotify/Apple; regional availability unclear" },
  "mb-ingest-kero-kero-bonito-sick-beat": { apple: "https://music.apple.com/us/song/1496245374" },
  "mb-ingest-aimer-zankyosanka": { apple: "https://music.apple.com/us/song/1594814706" },
  "mb-ingest-yaeji-raingurl": { spotify: "https://open.spotify.com/track/4gRAniZdYF2zVrDUsNC9tU", apple: "https://music.apple.com/us/song/1510806531" },
  "mb-ingest-100-gecs-money-machine": { spotify: "https://open.spotify.com/track/61bwFjzXGG1x2aZsANdLyl", apple: "https://music.apple.com/us/song/1497364154" },
  "mb-ingest-silica-gel-desert-eagle": { spotify: "https://open.spotify.com/album/3z3iDsyby0fu7TxpQ74OrO", apple: "https://music.apple.com/us/song/1703562329", note: "spotify link album-level" },
  "mb-ingest-mrs-green-apple-inferno": { spotify: "https://open.spotify.com/track/2n8v7VTA4kfehMWa5qQ7ya", apple: "https://music.apple.com/us/song/1471459432" },
  "mb-ingest-hikaru-utada-automatic": { spotify: "https://open.spotify.com/track/1yqheJwk8wusDOM8jmJ2o0", apple: "https://music.apple.com/us/song/1647641935" },
  "mb-ingest-yung-lean-ginseng-strip-2002": { spotify: "https://open.spotify.com/track/79nEEoEPY2w8EXj9hjn5oc" },
  "mb-ingest-boards-of-canada-roygbiv": { spotify: "https://open.spotify.com/track/5Hf2h59YLInKlic7ooWZVd", apple: "https://music.apple.com/us/song/281116081" },
  "mb-ingest-aespa-next-level": { spotify: "https://open.spotify.com/track/2zrhoHlFKxFTRF5aMyxMoQ", apple: "https://music.apple.com/us/song/1567326688" },
  "mb-ingest-balming-tiger-armadillo": { spotify: "https://open.spotify.com/track/6P9q7KzVQx7cJp0jJmU4mK", apple: "https://music.apple.com/us/song/1450462639" },
  "mb-ingest-jamie-xx-gosh": { spotify: "https://open.spotify.com/track/4Bs9za1dNjA5SBZPN0mzk1", apple: "https://music.apple.com/us/song/1525506452" },
  "mb-ingest-anri-last-summer-whisper": { spotify: "https://open.spotify.com/track/5W4UIccVrBQURMsvGyj4T8", apple: "https://music.apple.com/us/song/834248226" },
  "mb-ingest-alice-longyu-gao-rich-bitch-juice": { spotify: "https://open.spotify.com/track/23QNeWdV1uiLA8OyZ60mee", apple: "https://music.apple.com/us/song/1489001818" },
  "mb-ingest-oneohtrix-point-never-sticky-drama": { spotify: "https://open.spotify.com/track/7KaTuRCeTiqlVlQNOFX3wg", apple: "https://music.apple.com/us/song/1035616163" },
  "mb-ingest-ryokuoushoku-shakai-shout-baby": { spotify: "https://open.spotify.com/track/5j4GrEcK99AsgDspM9tCQ2", apple: "https://music.apple.com/us/song/1538153872" },
  "mb-ingest-se-so-neon-a-long-dream": { spotify: "https://open.spotify.com/track/4nXbMeiYZCMxl2B7NvxLdR", apple: "https://music.apple.com/us/song/1450481735" },
  "mb-ingest-king-gnu-specialz": { spotify: "https://open.spotify.com/track/0GWNtMohuYUEHVZ40tcnHF", apple: "https://music.apple.com/us/song/1702823583" },
  "mb-ingest-neon-bunny-seoul": { spotify: "https://open.spotify.com/track/2NLSzPeZNvwcRL4dwTpeGA", apple: "https://music.apple.com/us/song/1747806485" },
  "mb-ingest-rico-nasty-ohfr": { spotify: "https://open.spotify.com/track/6OOxE4rTl7k5VOMlcy0cdW", apple: "https://music.apple.com/us/song/1747458518" },
  "mb-ingest-tomoko-aran-midnight-pretenders": { spotify: "https://open.spotify.com/track/0JUWF44gfMszGNhjCF7Ufs", apple: "https://music.apple.com/us/song/339701060" },
  "mb-ingest-blackpink-kill-this-love": { spotify: "https://open.spotify.com/track/0M98PvIvx7vZ8LDpzMw1hB", apple: "https://music.apple.com/us/song/1551479992" },
  "mb-ingest-akmu-how-can-i-love-the-heartbreak-you-re-the-on": { spotify: "https://open.spotify.com/track/4FObSSNE4O4dgzD4iHFprW", apple: "https://music.apple.com/us/song/1480802550" },
  "mb-ingest-caroline-polachek-so-hot-you-re-hurting-my-feeli": { spotify: "https://open.spotify.com/track/1hjQ3EARnSDznlLaXaWAhf", apple: "https://music.apple.com/us/song/1482705847" },
  "mb-ingest-burial-archangel": { spotify: "https://open.spotify.com/track/55gnBQAhU5rGzLsXTAx2MM", apple: "https://music.apple.com/us/song/893175788" },
  "mb-ingest-official-hige-dandism-pretender": { spotify: "https://open.spotify.com/track/0peJAyrJ03wHnagMFlpgun", apple: "https://music.apple.com/us/song/1479397873" },
  "mb-ingest-glaive-i-wanna-slam-my-head-against-the-wall": { spotify: "https://open.spotify.com/track/6R6BWPO6FaaMRqSq82V0pM", apple: "https://music.apple.com/us/song/1606018322" },
  "mb-ingest-hyukoh-tomboy": { spotify: "https://open.spotify.com/track/6DA7kCWYMggJjqPM84V2Ng", apple: "https://music.apple.com/us/song/1450778317" },
  "mb-ingest-black-dresses-creep-u": { spotify: "https://open.spotify.com/track/7F3EoSo1c556rcpYq92jbl", apple: "https://music.apple.com/us/song/1579703082" },
  "mb-ingest-charli-xcx-track-10": { spotify: "https://open.spotify.com/track/4t9PBD27dndlf6YMBK2ROc" },
  "mb-ingest-sophie-faceshopping": { spotify: "https://open.spotify.com/track/3nW3QgnF3if5cro5gDEQFw", apple: "https://music.apple.com/us/song/1709023357" },
  "mb-ingest-junko-ohashi-telephone-number": { spotify: "https://open.spotify.com/track/3nByGKtrUugm8bfsNGazAV", apple: "https://music.apple.com/us/song/1697200090" },
  "mb-ingest-yumi-matsutoya-haru-yo-koi": { spotify: "https://open.spotify.com/track/3ynkrN8ztKtsm2jUKSuAda", apple: "https://music.apple.com/us/song/1436012884" },
  "mb-ingest-yerin-baek-maybe-it-s-not-our-fault": { spotify: "https://open.spotify.com/track/5fuOfU241WSA328TgwsFgj", apple: "https://music.apple.com/us/song/1698534874" },
  "mb-ingest-the-black-skirts-everything": { spotify: "https://open.spotify.com/track/4vb7g4GrE9cOrhEzUWadN8", apple: "https://music.apple.com/us/song/1242155576" },
};

const golden = JSON.parse(fs.readFileSync("data/golden-set.json", "utf8"));
const existing = new Set(golden.cases.map((c) => c.candidateId));
const added = [];

for (const [seedId, urls] of Object.entries(URL_MAP)) {
  if (existing.has(seedId)) continue;
  const seed = JSON.parse(fs.readFileSync(`${INGESTED}/${seedId}.json`, "utf8"));
  const platforms = {
    spotify: urls.spotify ? { state: "available", url: urls.spotify } : { state: "unknown" },
    youtube_music: { state: "unknown" },
    apple_music: urls.apple ? { state: "available", url: urls.apple } : { state: "unknown" },
    soundcloud: { state: "unknown" },
    bandcamp: { state: "missing" },
    melon: { state: "unknown" },
  };
  if (urls.note) {
    platforms.spotify.note = urls.note;
  }
  added.push({
    id: `golden-mb-${seedId.replace("mb-ingest-", "")}`,
    scene: SCENE_BY_ID.get(seedId) ?? "internet",
    candidateId: seedId,
    canonical: {
      artist: seed.metadata.artist_credit,
      title: seed.metadata.title,
      release: seed.metadata.release_title,
      durationMs: seed.metadata.duration_ms,
      isrc: seed.metadata.isrcs[0],
    },
    musicbrainz: { recordingMbid: seed.identity.recording_mbid },
    versionDistinction: "original_studio",
    queries: [`${seed.metadata.artist_credit} ${seed.metadata.title}`],
    acceptableTop3Ids: [seedId],
    rationale: `MusicBrainz ws/2 api_retrieved identity (${seed.identity.recording_mbid}); platform URLs web-verified 2026-08-19.${urls.note ? " " + urls.note : ""}`,
    platforms,
  });
}

golden.cases = [...golden.cases, ...added];
fs.writeFileSync("data/golden-set.json", JSON.stringify(golden, null, 2) + "\n");
console.log(`golden-set: ${golden.cases.length} cases (+${added.length})`);
