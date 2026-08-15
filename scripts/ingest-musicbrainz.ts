import { parseArgs } from "node:util";

const MBID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const MUSICBRAINZ_POLICY = {
  redistributed_fields: "musicbrainz_core_metadata_only",
  excluded_fields: [
    "annotations",
    "audio",
    "cover_art",
    "edit_history",
    "ratings",
    "tags",
  ],
  permitted_use: "offline_positive_recording_identity_fixture",
  license_id: "CC0-1.0",
  license_url: "https://creativecommons.org/publicdomain/zero/1.0/",
  musicbrainz_data_license_url: "https://musicbrainz.org/doc/About/Data_License",
  musicbrainz_database_scope_url: "https://musicbrainz.org/doc/MusicBrainz_Database",
  musicbrainz_api_docs_url: "https://musicbrainz.org/doc/MusicBrainz_API",
  musicbrainz_rate_limit_url: "https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting",
  api_usage: {
    meaningful_user_agent_required: true,
    source_ip_average_requests_per_second_maximum: 1,
    polling_for_changes_allowed: false,
  },
} as const;

export const DEFAULT_USER_AGENT =
  "ReleaseCheck/0.1 (+https://github.com/release-check/app; musicbrainz-ingest)";

export const RATE_LIMIT_INTERVAL_MS = 1000;
export const RECORDING_INCLUDES = "artists+releases+release-groups+isrcs";
export const RELEASE_INCLUDES = "recordings";

export const CHECKED_FIELDS = [
  "recording_mbid",
  "track_mbid",
  "release_mbid",
  "release_group_mbid",
  "artist_mbids",
  "title",
  "artist_credit",
  "release_status",
  "release_date",
  "duration_ms",
  "isrcs",
] as const;

export interface MusicBrainzIngestSeed {
  seed_id: string;
  classification: "verified_musicbrainz_recording";
  identity: {
    recording_mbid: string;
    track_mbid: string;
    release_mbid: string;
    release_group_mbid: string;
    artist_mbids: string[];
  };
  metadata: {
    title: string;
    artist_credit: string;
    release_title: string;
    release_status: "official";
    release_date: string;
    duration_ms: number;
    duration_precision: "display_seconds";
    isrcs: string[];
  };
  source: {
    provider: "MusicBrainz";
    source_identifier: string;
    recording_url: string;
    release_url: string;
    api_lookup_url: string;
    retrieved_at: string;
    retrieval_method: "musicbrainz_ws2_recording_lookup";
  };
  label: {
    kind: "positive_recording_identity";
    expected_relationship: "exact_musicbrainz_recording";
    expected_recording_mbid: string;
    rationale: string;
  };
  verification: {
    state: "api_retrieved";
    verified_at: string;
    method: string;
    verified_by_role: "ingest_script";
    checked_fields: string[];
  };
  policy_provenance: {
    license_id: "CC0-1.0";
    license_url: string;
    data_scope: "core_metadata_only";
    api_docs_url: string;
    rate_limit_url: string;
    redistribution: "permitted_core_metadata";
    policy_note: string;
  };
}

interface MbArtistCreditEntry {
  name?: string;
  artist?: { id?: string; name?: string };
}

interface MbReleaseSummary {
  id?: string;
  title?: string;
  status?: string;
  date?: string;
  "release-group"?: { id?: string };
}

interface MbRecordingResponse {
  id?: string;
  title?: string;
  length?: number;
  isrcs?: string[];
  "artist-credit"?: MbArtistCreditEntry[];
  releases?: MbReleaseSummary[];
}

interface MbTrackSummary {
  id?: string;
  title?: string;
  length?: number;
  recording?: { id?: string };
}

interface MbReleaseResponse {
  id?: string;
  media?: Array<{ tracks?: MbTrackSummary[] }>;
}

export interface IngestMusicBrainzOptions {
  recordingMbid: string;
  artistHint?: string;
  titleHint?: string;
  seedId?: string;
  fetchFn?: typeof fetch;
  userAgent?: string;
  rateLimiter?: MusicBrainzRateLimiter;
  now?: () => Date;
  maxAttempts?: number;
}

export class MusicBrainzRateLimiter {
  private lastRequestAt: number | null = null;

  constructor(
    private readonly minIntervalMs = RATE_LIMIT_INTERVAL_MS,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
    private readonly clock: () => number = () => Date.now(),
  ) {}

  async waitForTurn(): Promise<void> {
    if (this.lastRequestAt !== null) {
      const elapsed = this.clock() - this.lastRequestAt;
      if (elapsed < this.minIntervalMs) {
        await this.sleep(this.minIntervalMs - elapsed);
      }
    }
    this.lastRequestAt = this.clock();
  }

  reset(): void {
    this.lastRequestAt = null;
  }
}

export function assertRecordingMbid(value: string): void {
  if (!MBID_PATTERN.test(value)) {
    throw new Error(`invalid recording MBID: ${value}`);
  }
}

export function buildRecordingLookupUrl(recordingMbid: string): string {
  assertRecordingMbid(recordingMbid);
  const params = new URLSearchParams({
    inc: RECORDING_INCLUDES,
    fmt: "json",
  });
  return `https://musicbrainz.org/ws/2/recording/${recordingMbid}?${params.toString()}`;
}

export function buildReleaseLookupUrl(releaseMbid: string): string {
  if (!MBID_PATTERN.test(releaseMbid)) {
    throw new Error(`invalid release MBID: ${releaseMbid}`);
  }
  const params = new URLSearchParams({
    inc: RELEASE_INCLUDES,
    fmt: "json",
  });
  return `https://musicbrainz.org/ws/2/release/${releaseMbid}?${params.toString()}`;
}

export function formatUtcInstant(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function roundDurationToDisplaySeconds(lengthMs: number): number {
  if (!Number.isFinite(lengthMs) || lengthMs <= 0) {
    throw new Error("recording length must be a positive number");
  }
  return Math.round(lengthMs / 1000) * 1000;
}

export function formatArtistCredit(entries: MbArtistCreditEntry[] | undefined): {
  artistCredit: string;
  artistMbids: string[];
} {
  const artistCredit = (entries ?? [])
    .map((entry) => entry.name ?? entry.artist?.name ?? "")
    .join("")
    .trim();
  const artistMbids = (entries ?? [])
    .map((entry) => entry.artist?.id)
    .filter((id): id is string => typeof id === "string" && MBID_PATTERN.test(id));

  if (!artistCredit || artistMbids.length === 0) {
    throw new Error("recording response is missing artist credit");
  }

  return { artistCredit, artistMbids };
}

export function scoreRelease(
  release: MbReleaseSummary,
  artistHint?: string,
  titleHint?: string,
): number {
  let score = 0;
  const status = (release.status ?? "").toLowerCase();
  if (status === "official") {
    score += 100;
  } else {
    return -1;
  }

  if (titleHint && release.title) {
    if (normalizeForMatch(release.title) === normalizeForMatch(titleHint)) {
      score += 40;
    } else if (normalizeForMatch(release.title).includes(normalizeForMatch(titleHint))) {
      score += 20;
    }
  }

  if (artistHint) {
    score += 1;
  }

  if (release.date) {
    score += 1;
  }

  return score;
}

export function selectOfficialRelease(
  releases: MbReleaseSummary[] | undefined,
  artistHint?: string,
  titleHint?: string,
): MbReleaseSummary {
  const ranked = (releases ?? [])
    .map((release) => ({ release, score: scoreRelease(release, artistHint, titleHint) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || (left.release.date ?? "").localeCompare(right.release.date ?? ""));

  const selected = ranked[0]?.release;
  if (!selected?.id || !selected["release-group"]?.id) {
    throw new Error("no official release with release-group metadata found for recording");
  }

  return selected;
}

export function findTrackForRecording(
  release: MbReleaseResponse,
  recordingMbid: string,
  titleHint?: string,
): MbTrackSummary {
  const tracks = (release.media ?? []).flatMap((medium) => medium.tracks ?? []);
  const matches = tracks.filter((track) => track.recording?.id === recordingMbid && typeof track.id === "string");

  if (matches.length === 0) {
    throw new Error(`no track linked to recording ${recordingMbid} on release ${release.id ?? "unknown"}`);
  }

  if (titleHint) {
    const normalizedHint = normalizeForMatch(titleHint);
    const titled = matches.find((track) => normalizeForMatch(track.title ?? "") === normalizedHint);
    if (titled?.id) {
      return titled;
    }
  }

  return matches[0];
}

export function slugifySeedId(artistCredit: string, title: string): string {
  const slug = `${artistCredit}-${title}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug ? `mb-ingest-${slug}` : "mb-ingest-recording";
}

export function mapMusicBrainzResponsesToSeed(input: {
  recording: MbRecordingResponse;
  release: MbReleaseResponse;
  selectedRelease: MbReleaseSummary;
  track: MbTrackSummary;
  retrievedAt: string;
  seedId?: string;
  artistHint?: string;
  titleHint?: string;
}): MusicBrainzIngestSeed {
  const recordingMbid = input.recording.id;
  const releaseMbid = input.selectedRelease.id;
  const releaseGroupMbid = input.selectedRelease["release-group"]?.id;
  const trackMbid = input.track.id;

  if (!recordingMbid || !releaseMbid || !releaseGroupMbid || !trackMbid) {
    throw new Error("recording ingest response is missing required MBIDs");
  }

  const { artistCredit, artistMbids } = formatArtistCredit(input.recording["artist-credit"]);
  const title = input.recording.title ?? input.titleHint;
  if (!title) {
    throw new Error("recording response is missing title");
  }

  const durationMs = roundDurationToDisplaySeconds(
    input.recording.length ?? input.track.length ?? 0,
  );
  const releaseDate = input.selectedRelease.date ?? "0000";
  const isrcs = (input.recording.isrcs ?? []).map((isrc) => isrc.toUpperCase());

  const rationaleParts = [
    "Selected an official MusicBrainz release track linked to the requested recording MBID.",
  ];
  if (input.artistHint) {
    rationaleParts.push(`Artist hint: ${input.artistHint}.`);
  }
  if (input.titleHint) {
    rationaleParts.push(`Title hint: ${input.titleHint}.`);
  }

  return {
    seed_id: input.seedId ?? slugifySeedId(artistCredit, title),
    classification: "verified_musicbrainz_recording",
    identity: {
      recording_mbid: recordingMbid,
      track_mbid: trackMbid,
      release_mbid: releaseMbid,
      release_group_mbid: releaseGroupMbid,
      artist_mbids: artistMbids,
    },
    metadata: {
      title,
      artist_credit: artistCredit,
      release_title: input.selectedRelease.title ?? title,
      release_status: "official",
      release_date: releaseDate,
      duration_ms: durationMs,
      duration_precision: "display_seconds",
      isrcs,
    },
    source: {
      provider: "MusicBrainz",
      source_identifier: `musicbrainz:recording:${recordingMbid}`,
      recording_url: `https://musicbrainz.org/recording/${recordingMbid}`,
      release_url: `https://musicbrainz.org/release/${releaseMbid}`,
      api_lookup_url: buildRecordingLookupUrl(recordingMbid),
      retrieved_at: input.retrievedAt,
      retrieval_method: "musicbrainz_ws2_recording_lookup",
    },
    label: {
      kind: "positive_recording_identity",
      expected_relationship: "exact_musicbrainz_recording",
      expected_recording_mbid: recordingMbid,
      rationale: rationaleParts.join(" "),
    },
    verification: {
      state: "api_retrieved",
      verified_at: input.retrievedAt,
      method:
        "Fetched recording and release metadata via MusicBrainz ws/2 lookup using the core-metadata-only whitelist.",
      verified_by_role: "ingest_script",
      checked_fields: [...CHECKED_FIELDS],
    },
    policy_provenance: {
      license_id: "CC0-1.0",
      license_url: MUSICBRAINZ_POLICY.musicbrainz_data_license_url,
      data_scope: "core_metadata_only",
      api_docs_url: MUSICBRAINZ_POLICY.musicbrainz_api_docs_url,
      rate_limit_url: MUSICBRAINZ_POLICY.musicbrainz_rate_limit_url,
      redistribution: "permitted_core_metadata",
      policy_note:
        "No cover art, audio, ratings, tags, annotations, edit history, or platform availability is redistributed or inferred.",
    },
  };
}

export async function fetchMusicBrainzJson<T>(
  url: string,
  options: {
    fetchFn: typeof fetch;
    userAgent: string;
    rateLimiter: MusicBrainzRateLimiter;
    maxAttempts?: number;
  },
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await options.rateLimiter.waitForTurn();
    const response = await options.fetchFn(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": options.userAgent,
      },
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    if (response.status === 429 || response.status >= 500) {
      lastError = new Error(`MusicBrainz request failed with status ${response.status}`);
      if (attempt < maxAttempts) {
        continue;
      }
    } else {
      throw new Error(`MusicBrainz request failed with status ${response.status}`);
    }
  }

  throw lastError ?? new Error("MusicBrainz request failed");
}

export async function ingestMusicBrainzRecording(
  options: IngestMusicBrainzOptions,
): Promise<MusicBrainzIngestSeed> {
  assertRecordingMbid(options.recordingMbid);

  const fetchFn = options.fetchFn ?? fetch;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const rateLimiter = options.rateLimiter ?? new MusicBrainzRateLimiter();
  const now = options.now ?? (() => new Date());
  const retrievedAt = formatUtcInstant(now());

  const recording = await fetchMusicBrainzJson<MbRecordingResponse>(
    buildRecordingLookupUrl(options.recordingMbid),
    {
      fetchFn,
      userAgent,
      rateLimiter,
      maxAttempts: options.maxAttempts,
    },
  );

  const selectedRelease = selectOfficialRelease(
    recording.releases,
    options.artistHint,
    options.titleHint,
  );

  const release = await fetchMusicBrainzJson<MbReleaseResponse>(
    buildReleaseLookupUrl(selectedRelease.id!),
    {
      fetchFn,
      userAgent,
      rateLimiter,
      maxAttempts: options.maxAttempts,
    },
  );

  const track = findTrackForRecording(release, options.recordingMbid, options.titleHint);

  return mapMusicBrainzResponsesToSeed({
    recording,
    release,
    selectedRelease,
    track,
    retrievedAt,
    seedId: options.seedId,
    artistHint: options.artistHint,
    titleHint: options.titleHint,
  });
}

function printUsage(): never {
  console.error(`Usage: bun run scripts/ingest-musicbrainz.ts <recording-mbid> [--artist <name>] [--title <name>] [--seed-id <id>] [--out <path>]

Writes a seed-shaped JSON object for one MusicBrainz recording identity lookup.`);
  process.exit(1);
}

export async function runCli(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      artist: { type: "string" },
      title: { type: "string" },
      "seed-id": { type: "string" },
      out: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printUsage();
  }

  const recordingMbid = positionals[0];
  if (!recordingMbid) {
    printUsage();
  }

  const seed = await ingestMusicBrainzRecording({
    recordingMbid,
    artistHint: values.artist,
    titleHint: values.title,
    seedId: values["seed-id"],
  });

  const serialized = `${JSON.stringify(seed, null, 2)}\n`;
  if (values.out) {
    await Bun.write(values.out, serialized);
    console.log(JSON.stringify({ out: values.out, seed_id: seed.seed_id }, null, 2));
    return;
  }

  process.stdout.write(serialized);
}

if (import.meta.main) {
  await runCli(process.argv.slice(2));
}
