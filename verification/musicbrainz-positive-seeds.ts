const MBID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/;
const RELEASE_DATE_PATTERN = /^\d{4}(?:-\d{2}-\d{2})?$/;
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

const EXPECTED_POLICY = {
  license_id: "CC0-1.0",
  musicbrainz_data_license_url: "https://musicbrainz.org/doc/About/Data_License",
  musicbrainz_database_scope_url: "https://musicbrainz.org/doc/MusicBrainz_Database",
  musicbrainz_api_docs_url: "https://musicbrainz.org/doc/MusicBrainz_API",
  musicbrainz_rate_limit_url: "https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting",
} as const;

const REQUIRED_CHECKED_FIELDS = [
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

export class MusicBrainzSeedValidationFailure extends Error {}

export interface MusicBrainzSeedValidationSummary {
  seed_count: number;
  unique_recording_mbids: number;
  complete_provenance_records: number;
  synthetic_rows_claimed_verified: number;
  policy_mapping_complete: true;
}

export function validateMusicBrainzPositiveSeeds(
  dataset: unknown,
): MusicBrainzSeedValidationSummary {
  assertRecord(dataset, "dataset");
  assertEqual(
    dataset.schema_version,
    "releasecheck.musicbrainz-positive-recordings.v1",
    "unexpected schema_version",
  );
  assertNonEmptyString(dataset.dataset_id, "dataset_id");
  assertNonEmptyString(dataset.iteration_id, "iteration_id");
  assertNonEmptyString(dataset.purpose, "purpose");
  assertEqual(
    dataset.classification,
    "verified_musicbrainz_recording",
    "dataset classification must describe verified MusicBrainz records",
  );
  assertEqual(dataset.verification_state, "hand_verified", "dataset must be hand verified");

  validateDatasetPolicy(dataset.policy);
  assertArray(dataset.seeds, "seeds");
  assert(
    dataset.seeds.length >= 5 && dataset.seeds.length <= 10,
    "positive seed count must be between 5 and 10",
  );

  const seedIds = new Set<string>();
  const recordingMbids = new Set<string>();
  const trackMbids = new Set<string>();
  let completeProvenanceRecords = 0;
  let syntheticRowsClaimedVerified = 0;

  for (const [index, seed] of dataset.seeds.entries()) {
    const path = `seeds[${index}]`;
    assertRecord(seed, path);
    assertNonEmptyString(seed.seed_id, `${path}.seed_id`);
    assert(!seedIds.has(seed.seed_id), `${path}.seed_id must be unique`);
    seedIds.add(seed.seed_id);

    if (
      ["synthetic", "synthetic_load", "handwritten_demo"].includes(
        String(seed.classification),
      ) &&
      isRecord(seed.verification) &&
      seed.verification.state === "hand_verified"
    ) {
      syntheticRowsClaimedVerified += 1;
    }

    assertEqual(
      seed.classification,
      "verified_musicbrainz_recording",
      `${path}.classification cannot be synthetic or handwritten demo data`,
    );

    const identity = validateIdentity(seed.identity, path);
    assert(!recordingMbids.has(identity.recordingMbid), `${path}.recording_mbid must be unique`);
    assert(!trackMbids.has(identity.trackMbid), `${path}.track_mbid must be unique`);
    recordingMbids.add(identity.recordingMbid);
    trackMbids.add(identity.trackMbid);

    validateMetadata(seed.metadata, path);
    validateSource(seed.source, identity, path);
    validateLabel(seed.label, identity.recordingMbid, path);
    validateVerification(seed.verification, path);
    validatePolicyProvenance(seed.policy_provenance, path);
    completeProvenanceRecords += 1;
  }

  assert(
    syntheticRowsClaimedVerified === 0,
    "synthetic or handwritten rows cannot be claimed as verified",
  );

  return {
    seed_count: dataset.seeds.length,
    unique_recording_mbids: recordingMbids.size,
    complete_provenance_records: completeProvenanceRecords,
    synthetic_rows_claimed_verified: syntheticRowsClaimedVerified,
    policy_mapping_complete: true,
  };
}

function validateDatasetPolicy(value: unknown): void {
  assertRecord(value, "policy");
  assertEqual(
    value.redistributed_fields,
    "musicbrainz_core_metadata_only",
    "only MusicBrainz core metadata may be redistributed",
  );
  assertEqual(
    value.permitted_use,
    "offline_positive_recording_identity_fixture",
    "unexpected permitted_use",
  );
  for (const [key, expected] of Object.entries(EXPECTED_POLICY)) {
    assertEqual(value[key], expected, `policy.${key} is not mapped to the official evidence`);
  }
  assertArray(value.excluded_fields, "policy.excluded_fields");
  for (const excluded of ["annotations", "audio", "cover_art", "ratings", "tags"]) {
    assert(value.excluded_fields.includes(excluded), `policy must exclude ${excluded}`);
  }
  assertRecord(value.api_usage, "policy.api_usage");
  assertEqual(
    value.api_usage.meaningful_user_agent_required,
    true,
    "MusicBrainz requires a meaningful User-Agent",
  );
  assertEqual(
    value.api_usage.source_ip_average_requests_per_second_maximum,
    1,
    "MusicBrainz source-IP rate limit must remain at one request per second",
  );
  assertEqual(
    value.api_usage.polling_for_changes_allowed,
    false,
    "MusicBrainz policy advises against polling for changes",
  );
}

function validateIdentity(
  value: unknown,
  path: string,
): { recordingMbid: string; trackMbid: string; releaseMbid: string } {
  assertRecord(value, `${path}.identity`);
  for (const key of ["recording_mbid", "track_mbid", "release_mbid", "release_group_mbid"]) {
    assertMbid(value[key], `${path}.identity.${key}`);
  }
  assertArray(value.artist_mbids, `${path}.identity.artist_mbids`);
  assert(value.artist_mbids.length > 0, `${path}.identity.artist_mbids must not be empty`);
  for (const [index, artistMbid] of value.artist_mbids.entries()) {
    assertMbid(artistMbid, `${path}.identity.artist_mbids[${index}]`);
  }

  return {
    recordingMbid: value.recording_mbid as string,
    trackMbid: value.track_mbid as string,
    releaseMbid: value.release_mbid as string,
  };
}

function validateMetadata(value: unknown, path: string): void {
  assertRecord(value, `${path}.metadata`);
  for (const key of ["title", "artist_credit", "release_title"]) {
    assertNonEmptyString(value[key], `${path}.metadata.${key}`);
  }
  assertEqual(value.release_status, "official", `${path} must use an official release`);
  assert(
    typeof value.release_date === "string" && RELEASE_DATE_PATTERN.test(value.release_date),
    `${path}.metadata.release_date must be YYYY or YYYY-MM-DD`,
  );
  assert(
    Number.isInteger(value.duration_ms) && (value.duration_ms as number) > 0,
    `${path}.metadata.duration_ms must be a positive integer`,
  );
  assert(
    (value.duration_ms as number) % 1000 === 0,
    `${path}.metadata.duration_ms must preserve display-second precision`,
  );
  assertEqual(
    value.duration_precision,
    "display_seconds",
    `${path}.metadata.duration_precision must disclose source precision`,
  );
  assertArray(value.isrcs, `${path}.metadata.isrcs`);
  for (const [index, isrc] of value.isrcs.entries()) {
    assert(
      typeof isrc === "string" && ISRC_PATTERN.test(isrc),
      `${path}.metadata.isrcs[${index}] must be an ISRC`,
    );
  }
}

function validateSource(
  value: unknown,
  identity: { recordingMbid: string; releaseMbid: string },
  path: string,
): void {
  assertRecord(value, `${path}.source`);
  assertEqual(value.provider, "MusicBrainz", `${path}.source.provider must be MusicBrainz`);
  assertEqual(
    value.source_identifier,
    `musicbrainz:recording:${identity.recordingMbid}`,
    `${path}.source.source_identifier must bind to the recording MBID`,
  );
  assertEqual(
    value.recording_url,
    `https://musicbrainz.org/recording/${identity.recordingMbid}`,
    `${path}.source.recording_url must bind to the recording MBID`,
  );
  assertEqual(
    value.release_url,
    `https://musicbrainz.org/release/${identity.releaseMbid}`,
    `${path}.source.release_url must bind to the release MBID`,
  );
  assertEqual(
    value.api_lookup_url,
    `https://musicbrainz.org/ws/2/recording/${identity.recordingMbid}?inc=artists%2Breleases%2Brelease-groups%2Bisrcs&fmt=json`,
    `${path}.source.api_lookup_url must use the official recording lookup`,
  );
  assertIsoInstant(value.retrieved_at, `${path}.source.retrieved_at`);
  assertEqual(
    value.retrieval_method,
    "manual_official_entity_review",
    `${path}.source.retrieval_method must disclose manual verification`,
  );
}

function validateLabel(value: unknown, recordingMbid: string, path: string): void {
  assertRecord(value, `${path}.label`);
  assertEqual(
    value.kind,
    "positive_recording_identity",
    `${path}.label.kind must be a positive identity label`,
  );
  assertEqual(
    value.expected_relationship,
    "exact_musicbrainz_recording",
    `${path}.label.expected_relationship must be exact`,
  );
  assertEqual(
    value.expected_recording_mbid,
    recordingMbid,
    `${path}.label.expected_recording_mbid must match identity.recording_mbid`,
  );
  assertNonEmptyString(value.rationale, `${path}.label.rationale`);
}

function validateVerification(value: unknown, path: string): void {
  assertRecord(value, `${path}.verification`);
  assertEqual(value.state, "hand_verified", `${path}.verification.state must be hand_verified`);
  assertIsoInstant(value.verified_at, `${path}.verification.verified_at`);
  assertNonEmptyString(value.method, `${path}.verification.method`);
  assertNonEmptyString(value.verified_by_role, `${path}.verification.verified_by_role`);
  assertArray(value.checked_fields, `${path}.verification.checked_fields`);
  for (const field of REQUIRED_CHECKED_FIELDS) {
    assert(
      value.checked_fields.includes(field),
      `${path}.verification.checked_fields must include ${field}`,
    );
  }
}

function validatePolicyProvenance(value: unknown, path: string): void {
  assertRecord(value, `${path}.policy_provenance`);
  assertEqual(value.license_id, "CC0-1.0", `${path}.policy_provenance.license_id`);
  assertEqual(
    value.license_url,
    EXPECTED_POLICY.musicbrainz_data_license_url,
    `${path}.policy_provenance.license_url`,
  );
  assertEqual(value.data_scope, "core_metadata_only", `${path}.policy_provenance.data_scope`);
  assertEqual(
    value.api_docs_url,
    EXPECTED_POLICY.musicbrainz_api_docs_url,
    `${path}.policy_provenance.api_docs_url`,
  );
  assertEqual(
    value.rate_limit_url,
    EXPECTED_POLICY.musicbrainz_rate_limit_url,
    `${path}.policy_provenance.rate_limit_url`,
  );
  assertEqual(
    value.redistribution,
    "permitted_core_metadata",
    `${path}.policy_provenance.redistribution`,
  );
  assertNonEmptyString(value.policy_note, `${path}.policy_provenance.policy_note`);
}

function assertMbid(value: unknown, path: string): void {
  assert(typeof value === "string" && MBID_PATTERN.test(value), `${path} must be an MBID`);
}

function assertIsoInstant(value: unknown, path: string): void {
  assert(
    typeof value === "string" && ISO_INSTANT_PATTERN.test(value) && !Number.isNaN(Date.parse(value)),
    `${path} must be a UTC ISO-8601 instant`,
  );
}

function assertNonEmptyString(value: unknown, path: string): asserts value is string {
  assert(typeof value === "string" && value.trim().length > 0, `${path} is required`);
}

function assertArray(value: unknown, path: string): asserts value is unknown[] {
  assert(Array.isArray(value), `${path} must be an array`);
}

function assertRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  assert(
    typeof value === "object" && value !== null && !Array.isArray(value),
    `${path} must be an object`,
  );
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  assert(actual === expected, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new MusicBrainzSeedValidationFailure(message);
  }
}
