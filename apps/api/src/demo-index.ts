import type { Candidate } from "./types";

export const DEMO_INDEX: Candidate[] = [
  {
    id: "demo-park-hye-jin-like-this",
    canonical: {
      artist: "Park Hye Jin",
      title: "Like This",
      release: "How can I",
      durationSeconds: 213,
      isrc: "GBKPL2044181",
    },
    confidence: 0.96,
    ambiguity: [],
    evidence: [
      { field: "artist", score: 0.94, note: "normalized artist match" },
      { field: "title", score: 0.99, note: "exact normalized title match" },
      { field: "duration", score: 0.91, note: "duration within 2 seconds" },
      { field: "isrc", score: 1, note: "exact ISRC match where available" },
    ],
    availability: {
      spotify: {
        state: "available",
        url: "https://open.spotify.com/search/Park%20Hye%20Jin%20Like%20This",
      },
      youtube_music: {
        state: "available",
        url: "https://music.youtube.com/search?q=Park%20Hye%20Jin%20Like%20This",
      },
      apple_music: {
        state: "available",
        url: "https://music.apple.com/search?term=Park%20Hye%20Jin%20Like%20This",
      },
      soundcloud: {
        state: "duplicate_candidate",
        note: "multiple uploads need canonical source confirmation",
      },
      bandcamp: {
        state: "unknown",
        note: "not present in the demo index yet",
      },
      melon: {
        state: "region_locked",
        region: "KR",
        note: "availability should be verified through indexed regional data",
      },
    },
  },
  {
    id: "demo-dj-python-angel",
    canonical: {
      artist: "DJ Python",
      title: "Angel",
      release: "Mas Amable",
      durationSeconds: 417,
    },
    confidence: 0.89,
    ambiguity: ["same-title"],
    evidence: [
      { field: "artist", score: 0.98, note: "exact normalized artist match" },
      { field: "title", score: 0.88, note: "same title with release context" },
      { field: "album", score: 0.92, note: "release title supports candidate" },
      { field: "duration", score: 0.78, note: "duration needs platform confirmation" },
    ],
    availability: {
      spotify: {
        state: "available",
        url: "https://open.spotify.com/search/DJ%20Python%20Angel",
      },
      youtube_music: {
        state: "available",
        url: "https://music.youtube.com/search?q=DJ%20Python%20Angel",
      },
      apple_music: {
        state: "available",
        url: "https://music.apple.com/search?term=DJ%20Python%20Angel",
      },
      soundcloud: {
        state: "unknown",
        note: "not present in the demo index yet",
      },
      bandcamp: {
        state: "missing",
        note: "no indexed candidate found",
      },
      melon: {
        state: "unknown",
        note: "regional catalog has not been indexed",
      },
    },
  },
  {
    id: "demo-dj-python-angel-live-demo",
    canonical: {
      artist: "DJ Python",
      title: "Angel (Live Demo)",
      release: "Unreleased live recording",
      durationSeconds: 399,
    },
    confidence: 0.63,
    ambiguity: ["live", "demo", "same-title"],
    evidence: [
      { field: "artist", score: 0.98, note: "exact normalized artist match" },
      { field: "title", score: 0.72, note: "base title matches but version marker differs" },
      { field: "version", score: 0.35, note: "live demo marker should not collapse into original" },
      { field: "duration", score: 0.65, note: "duration differs from indexed original" },
    ],
    availability: {
      spotify: {
        state: "missing",
        note: "no indexed official release candidate found",
      },
      youtube_music: {
        state: "duplicate_candidate",
        note: "user uploads and live clips need canonical source confirmation",
      },
      apple_music: {
        state: "missing",
        note: "no indexed official release candidate found",
      },
      soundcloud: {
        state: "unknown",
        note: "not present in the demo index yet",
      },
      bandcamp: {
        state: "unknown",
        note: "not present in the demo index yet",
      },
      melon: {
        state: "unknown",
        note: "regional catalog has not been indexed",
      },
    },
  },
  {
    id: "demo-massive-attack-angel",
    canonical: {
      artist: "Massive Attack",
      title: "Angel",
      release: "Mezzanine",
      durationSeconds: 379,
      isrc: "GBAAA9800328",
    },
    confidence: 0.58,
    ambiguity: ["same-title"],
    evidence: [
      { field: "title", score: 1, note: "exact title match" },
      { field: "artist", score: 0.12, note: "different artist from DJ Python query" },
      { field: "release", score: 0.2, note: "different release context" },
    ],
    availability: {
      spotify: {
        state: "available",
        url: "https://open.spotify.com/search/Massive%20Attack%20Angel",
      },
      youtube_music: {
        state: "available",
        url: "https://music.youtube.com/search?q=Massive%20Attack%20Angel",
      },
      apple_music: {
        state: "available",
        url: "https://music.apple.com/search?term=Massive%20Attack%20Angel",
      },
      soundcloud: {
        state: "duplicate_candidate",
        note: "multiple uploads should not be treated as canonical availability",
      },
      bandcamp: {
        state: "removed",
        note: "historical candidate removed from indexed catalog",
      },
      melon: {
        state: "region_locked",
        region: "KR",
        note: "availability should be verified through indexed regional data",
      },
    },
  },
];

export function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function searchDemoIndex(query: string): Candidate[] {
  const normalized = normalize(query);
  if (!normalized) {
    return [];
  }

  const terms = normalized.split(" ").filter(Boolean);

  return DEMO_INDEX.map((candidate) => {
    const haystack = normalize(
      [
        candidate.canonical.artist,
        candidate.canonical.title,
        candidate.canonical.release ?? "",
        candidate.canonical.isrc ?? "",
        candidate.ambiguity.join(" "),
      ].join(" "),
    );

    const matchedTerms = terms.filter((term) => haystack.includes(term)).length;
    const exactArtistTitle =
      normalize(`${candidate.canonical.artist} ${candidate.canonical.title}`) === normalized;
    const baseScore =
      matchedTerms / terms.length +
      (exactArtistTitle ? 1 : 0) +
      candidate.confidence * 0.1;

    return { candidate, matchedTerms, score: baseScore };
  })
    .filter(({ matchedTerms }) => matchedTerms > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ candidate }) => candidate);
}

export function findAvailability(artist: string, track: string): Candidate | null {
  const normalizedArtist = normalize(artist);
  const normalizedTrack = normalize(track);

  return (
    DEMO_INDEX.find(
      (candidate) =>
        normalize(candidate.canonical.artist) === normalizedArtist &&
        normalize(candidate.canonical.title) === normalizedTrack,
    ) ?? null
  );
}

export function resolveDemoUrl(url: string): Candidate | null {
  const normalizedUrl = normalize(url);
  if (!normalizedUrl) {
    return null;
  }

  return (
    DEMO_INDEX.find((candidate) =>
      Object.values(candidate.availability).some((entry) =>
        entry.url ? normalize(entry.url) === normalizedUrl : false,
      ),
    ) ?? null
  );
}
