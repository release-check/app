import {
  assertGate,
  expectNegativeControl,
  REQUIRED_BASELINE_PROVENANCE_PATHS,
  runGate,
  sha256File,
  validateProvenanceManifest,
} from "../verification/baseline";

interface FixtureProvenance {
  path: string;
  content_sha256: string;
  classification: string;
  verification_state: string;
}

await runGate("baseline_provenance_integrity", async () => {
  const manifest = (await Bun.file("data/provenance/baseline.json").json()) as {
    fixtures: FixtureProvenance[];
  };
  validateProvenanceManifest(manifest);

  let hashMismatches = 0;
  for (const fixture of manifest.fixtures) {
    if ((await sha256File(fixture.path)) !== fixture.content_sha256) {
      hashMismatches += 1;
    }
  }
  assertGate(hashMismatches === 0, `${hashMismatches} fixture content hash mismatches`);

  const invalidManifest = structuredClone(manifest);
  invalidManifest.fixtures = invalidManifest.fixtures.filter(
    (fixture) => fixture.path !== "apps/api/src/demo-index.ts",
  );
  const negativeControl = expectNegativeControl("omitted_runtime_fixture", () =>
    validateProvenanceManifest(invalidManifest),
  );

  return {
    measurements: {
      fixture_records: manifest.fixtures.length,
      manifest_completeness_percent: Math.round(
        (manifest.fixtures.length / REQUIRED_BASELINE_PROVENANCE_PATHS.length) * 100,
      ),
      content_hash_mismatches: hashMismatches,
      synthetic_or_handwritten_rows_claimed_verified: manifest.fixtures.filter(
        (fixture) =>
          ["synthetic_load", "handwritten_demo"].includes(fixture.classification) &&
          fixture.verification_state === "verified",
      ).length,
      musicbrainz_policy_mapping: "not_applicable_baseline",
    },
    negative_control: negativeControl,
    limitations: [
      "The manifest records local fixture provenance only.",
      "MusicBrainz policy documented in docs/musicbrainz-policy.md; API ingest output requires human review before promotion to hand-verified seeds.",
    ],
  };
});
