import { availabilityFromSnapshot } from "./adapters";
import type { Candidate, PlatformAvailability } from "./types";

const scenes = ["korea-indie", "japan-doujin", "internet-scene", "club-tools", "archive-test"];
const titleRoots = [
  "Index Signal",
  "Cache Miss",
  "Regional Mirror",
  "Quiet Upload",
  "Catalog Drift",
  "Alias Check",
  "Version Trace",
  "Evidence Path",
];
const messySuffixes = ["", "Live", "Demo", "Remaster", "Instrumental", "Sped Up"];

export function buildSyntheticCandidates(count = 600): Candidate[] {
  return Array.from({ length: count }, (_, index) => buildSyntheticCandidate(index + 1));
}

function buildSyntheticCandidate(serial: number): Candidate {
  const scene = scenes[serial % scenes.length];
  const messyCase = serial % 3 === 0;
  const suffix = messyCase ? messySuffixes[serial % messySuffixes.length] : "";
  const title = `RC Synthetic ${titleRoots[serial % titleRoots.length]} ${serial
    .toString()
    .padStart(3, "0")}${suffix ? ` (${suffix})` : ""}`;
  const artist = `RC Synthetic Artist ${(serial % 75) + 1}`;
  const confidence = Math.max(0.52, 0.96 - (serial % 17) * 0.018);

  return {
    id: `synthetic-${serial.toString().padStart(4, "0")}`,
    canonical: {
      artist,
      title,
      release: `Synthetic ${scene} Set`,
      durationSeconds: 150 + (serial % 220),
      isrc: `RCSYN${serial.toString().padStart(7, "0")}`,
    },
    confidence,
    ambiguity: messyCase ? suffix.toLowerCase().split(" ") : [],
    evidence: [
      { field: "artist", score: 0.94, note: "synthetic normalized artist fixture" },
      { field: "title", score: 0.9, note: "synthetic normalized title fixture" },
      {
        field: "version",
        score: messyCase ? 0.55 : 1,
        note: messyCase
          ? "synthetic version marker should remain visible"
          : "no synthetic version conflict",
      },
    ],
    availability: buildAvailability(serial),
    sample: {
      origin: "synthetic_load",
      scene,
      messyCase,
      verified: false,
    },
  };
}

function buildAvailability(serial: number): PlatformAvailability {
  const cachedAt = "2026-07-06T00:00:00.000Z";

  return {
    spotify: availabilityFromSnapshot({
      platform: "spotify",
      state: serial % 11 === 0 ? "unknown" : "available",
      url: `https://open.spotify.com/search/RC%20Synthetic%20${serial}`,
      fetchedAt: cachedAt,
    }),
    youtube_music: availabilityFromSnapshot({
      platform: "youtube_music",
      state: serial % 7 === 0 ? "duplicate_candidate" : "available",
      url: `https://music.youtube.com/search?q=RC%20Synthetic%20${serial}`,
      fetchedAt: cachedAt,
    }),
    apple_music: availabilityFromSnapshot({
      platform: "apple_music",
      state: serial % 13 === 0 ? "missing" : "available",
      url: `https://music.apple.com/search?term=RC%20Synthetic%20${serial}`,
      fetchedAt: cachedAt,
    }),
    soundcloud: availabilityFromSnapshot({
      platform: "soundcloud",
      state: serial % 5 === 0 ? "unknown" : "missing",
      fetchedAt: cachedAt,
    }),
    bandcamp: availabilityFromSnapshot({
      platform: "bandcamp",
      state: serial % 17 === 0 ? "removed" : "unknown",
      fetchedAt: cachedAt,
    }),
    melon: availabilityFromSnapshot({
      platform: "melon",
      state: serial % 19 === 0 ? "region_locked" : "unknown",
      region: "KR",
      fetchedAt: cachedAt,
    }),
  };
}
