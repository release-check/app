import type { Candidate } from "./types";

/**
 * Hand-verified candidates built from the MusicBrainz positive-recording seed
 * dataset (`data/musicbrainz/positive-recording-seeds.v1.json`, CC0 core
 * metadata) plus public platform links collected on 2026-08-14.
 *
 * These are the first real-data entries in the search index. Availability
 * labels are seed-writer verified against public platform pages; identities
 * (MBID, title, artist, duration) are hand-verified against MusicBrainz.
 * Platform URLs not independently confirmed are left `unknown`, never guessed.
 */
export const VERIFIED_INDEX: Candidate[] = [
  {
    id: "verified-newjeans-ditto",
    canonical: {
      artist: "NewJeans",
      title: "Ditto",
      release: "NewJeans 'OMG'",
      durationSeconds: 186,
      isrc: "USA2P2254487",
    },
    confidence: 0.97,
    ambiguity: [],
    evidence: [
      { field: "artist", score: 1, note: "exact artist credit match" },
      { field: "title", score: 1, note: "exact title match" },
      { field: "duration", score: 0.97, note: "duration matches MusicBrainz recording" },
      {
        field: "musicbrainz",
        score: 1,
        note: "recording adf44a12-e5f4-48aa-9029-b9ef4b5f1d6d hand-verified",
      },
    ],
    availability: {
      spotify: {
        state: "available",
        url: "https://open.spotify.com/track/3r8RuvgbX9s7ammBn07D3W",
      },
      youtube_music: {
        state: "available",
        url: "https://music.youtube.com/watch?v=pSUydWEqKwE",
      },
      apple_music: {
        state: "available",
        url: "https://music.apple.com/us/song/1657231962",
      },
      soundcloud: {
        state: "unknown",
        note: "no official SoundCloud upload confirmed",
      },
      bandcamp: {
        state: "missing",
        note: "not present on Bandcamp",
      },
      melon: {
        state: "available",
        url: "https://www.melon.com/song/detail.htm?songId=35945927",
      },
    },
    sample: {
      origin: "verified_musicbrainz",
      scene: "korea",
      messyCase: false,
      verified: true,
    },
  },
  {
    id: "verified-bjork-joga",
    canonical: {
      artist: "Björk",
      title: "Jóga",
      release: "Homogenic",
      durationSeconds: 306,
    },
    confidence: 0.96,
    ambiguity: [],
    evidence: [
      { field: "artist", score: 1, note: "exact artist credit match" },
      { field: "title", score: 1, note: "exact title match" },
      { field: "duration", score: 0.95, note: "duration matches MusicBrainz recording" },
      {
        field: "musicbrainz",
        score: 1,
        note: "recording 83534ada-9f60-4093-bbf3-ca182a03cf8b hand-verified",
      },
    ],
    availability: {
      spotify: {
        state: "available",
        url: "https://open.spotify.com/track/18NehrWLUFK7NPH522YQMQ",
      },
      youtube_music: {
        state: "available",
        url: "https://music.youtube.com/watch?v=loB0kmz_0MM",
      },
      apple_music: {
        state: "available",
        url: "https://music.apple.com/us/song/1101192924",
      },
      soundcloud: {
        state: "unknown",
        note: "no official SoundCloud upload confirmed",
      },
      bandcamp: {
        state: "missing",
        note: "not present on Bandcamp",
      },
      melon: {
        state: "unknown",
        note: "regional catalog availability not verified",
      },
    },
    sample: {
      origin: "verified_musicbrainz",
      scene: "internet",
      messyCase: false,
      verified: true,
    },
  },
  {
    id: "verified-ymo-rydeen",
    canonical: {
      artist: "Yellow Magic Orchestra",
      title: "Rydeen",
      release: "Solid State Survivor",
      durationSeconds: 268,
    },
    confidence: 0.95,
    ambiguity: [],
    evidence: [
      { field: "artist", score: 1, note: "exact artist credit match" },
      { field: "title", score: 1, note: "exact title match" },
      { field: "duration", score: 0.94, note: "duration matches MusicBrainz recording" },
      {
        field: "musicbrainz",
        score: 1,
        note: "recording 96d9565e-0772-4202-9b8a-c52a96582bae hand-verified",
      },
    ],
    availability: {
      spotify: {
        state: "available",
        url: "https://open.spotify.com/track/3IzHpHPDwAT7gJK1yperlm",
      },
      youtube_music: {
        state: "available",
        url: "https://music.youtube.com/watch?v=Yxep-gS-Btg",
      },
      apple_music: {
        state: "available",
        url: "https://music.apple.com/us/song/1291838926",
      },
      soundcloud: {
        state: "unknown",
        note: "no official SoundCloud upload confirmed",
      },
      bandcamp: {
        state: "missing",
        note: "not present on Bandcamp",
      },
      melon: {
        state: "unknown",
        note: "regional catalog availability not verified",
      },
    },
    sample: {
      origin: "verified_musicbrainz",
      scene: "japan",
      messyCase: false,
      verified: true,
    },
  },
  {
    id: "verified-charli-xcx-vroom-vroom",
    canonical: {
      artist: "Charli XCX",
      title: "Vroom Vroom",
      release: "Vroom Vroom EP",
      durationSeconds: 193,
    },
    confidence: 0.94,
    ambiguity: [],
    evidence: [
      { field: "artist", score: 1, note: "exact artist credit match" },
      { field: "title", score: 1, note: "exact title match" },
      { field: "duration", score: 0.94, note: "duration matches MusicBrainz recording" },
      {
        field: "musicbrainz",
        score: 1,
        note: "recording 1c1d4379-4aef-4b6f-be69-b97c54db276f hand-verified",
      },
    ],
    availability: {
      spotify: {
        state: "available",
        url: "https://open.spotify.com/track/5hyq3LBlCfjRQAFkdQwe8o",
      },
      youtube_music: {
        state: "available",
        url: "https://music.youtube.com/watch?v=qfAqtFuGjWM",
      },
      apple_music: {
        state: "available",
        url: "https://music.apple.com/us/album/vroom-vroom-ep/1083723149",
        note: "album-level link; track-level page not confirmed",
      },
      soundcloud: {
        state: "unknown",
        note: "no official SoundCloud upload confirmed",
      },
      bandcamp: {
        state: "missing",
        note: "not present on Bandcamp",
      },
      melon: {
        state: "unknown",
        note: "regional catalog availability not verified",
      },
    },
    sample: {
      origin: "verified_musicbrainz",
      scene: "internet",
      messyCase: false,
      verified: true,
    },
  },
  {
    id: "verified-mariya-takeuchi-plastic-love",
    canonical: {
      artist: "Mariya Takeuchi",
      title: "Plastic Love",
      release: "Variety",
      durationSeconds: 294,
    },
    confidence: 0.95,
    ambiguity: [],
    evidence: [
      { field: "artist", score: 1, note: "exact artist credit match" },
      {
        field: "title",
        score: 1,
        note: "romanized canonical title; original プラスティック・ラブ",
      },
      { field: "duration", score: 0.95, note: "duration matches MusicBrainz recording" },
      {
        field: "musicbrainz",
        score: 1,
        note: "recording a5efcc7d-b28a-4917-bc4c-a23b6c59dee2 hand-verified",
      },
    ],
    availability: {
      spotify: {
        state: "available",
        url: "https://open.spotify.com/track/7rU6Iebxzlvqy5t857bKFq",
      },
      youtube_music: {
        state: "available",
        url: "https://music.youtube.com/watch?v=T_lC2O1oIew",
      },
      apple_music: {
        state: "available",
        url: "https://music.apple.com/us/song/1591437487",
      },
      soundcloud: {
        state: "unknown",
        note: "no official SoundCloud upload confirmed",
      },
      bandcamp: {
        state: "missing",
        note: "not present on Bandcamp",
      },
      melon: {
        state: "unknown",
        note: "regional catalog availability not verified",
      },
    },
    sample: {
      origin: "verified_musicbrainz",
      scene: "japan",
      messyCase: false,
      verified: true,
    },
  },
];
