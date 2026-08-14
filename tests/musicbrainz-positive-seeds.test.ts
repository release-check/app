import { describe, expect, test } from "bun:test";

import {
  MusicBrainzSeedValidationFailure,
  validateMusicBrainzPositiveSeeds,
} from "../verification/musicbrainz-positive-seeds";

const DATASET_PATH = "data/musicbrainz/positive-recording-seeds.v1.json";

async function loadDataset(): Promise<Record<string, unknown>> {
  return (await Bun.file(DATASET_PATH).json()) as Record<string, unknown>;
}

describe("MusicBrainz positive recording seed dataset", () => {
  test("accepts five complete hand-verified positive recording identities", async () => {
    const summary = validateMusicBrainzPositiveSeeds(await loadDataset());

    expect(summary).toEqual({
      seed_count: 5,
      unique_recording_mbids: 5,
      complete_provenance_records: 5,
      synthetic_rows_claimed_verified: 0,
      policy_mapping_complete: true,
    });
  });

  test("rejects a seed with incomplete source and retrieval provenance", async () => {
    const invalid = structuredClone(await loadDataset());
    const seeds = invalid.seeds as Array<Record<string, unknown>>;
    const source = seeds[0].source as Record<string, unknown>;
    delete source.retrieved_at;

    expect(() => validateMusicBrainzPositiveSeeds(invalid)).toThrow(
      MusicBrainzSeedValidationFailure,
    );
  });

  test("rejects a positive label bound to a different recording", async () => {
    const invalid = structuredClone(await loadDataset());
    const seeds = invalid.seeds as Array<Record<string, unknown>>;
    const label = seeds[0].label as Record<string, unknown>;
    label.expected_recording_mbid = "00000000-0000-0000-0000-000000000000";

    expect(() => validateMusicBrainzPositiveSeeds(invalid)).toThrow(
      MusicBrainzSeedValidationFailure,
    );
  });

  test("rejects synthetic data overclaimed as hand verified", async () => {
    const invalid = structuredClone(await loadDataset());
    const seeds = invalid.seeds as Array<Record<string, unknown>>;
    seeds[0].classification = "synthetic_load";

    expect(() => validateMusicBrainzPositiveSeeds(invalid)).toThrow(
      MusicBrainzSeedValidationFailure,
    );
  });
});
