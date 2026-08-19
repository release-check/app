import { describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";

// Persistence tests need a DB — set before any storage import.
process.env.RELEASE_CHECK_DB = "/tmp/rc-storage-test.db";
rmSync("/tmp/rc-storage-test.db", { force: true });

const { getDb, bootstrapFromFixtures, loadCandidates, addSubmission, listSubmissions, updateSubmissionStatus, upsertAvailability } =
  await import("../apps/api/src/storage");

describe("sqlite storage", () => {
  test("bootstraps fixture candidates into the database", () => {
    const db = getDb();
    const count = bootstrapFromFixtures(db!);
    expect(count).toBeGreaterThan(50); // demo + verified + ingested
    const loaded = loadCandidates(db!);
    expect(loaded.length).toBe(count);
    const ditto = loaded.find((c) => c.id === "verified-newjeans-ditto");
    expect(ditto?.canonical.artist).toBe("NewJeans");
    expect(ditto?.availability.spotify.state).toBe("available");
    // synthetic load fixtures are not persisted
    expect(loaded.some((c) => c.sample?.origin === "synthetic_load")).toBe(false);
  });

  test("round-trips availability updates", () => {
    const db = getDb();
    upsertAvailability(db!, "verified-newjeans-ditto", "melon", {
      state: "available",
      url: "https://www.melon.com/song/detail.htm?songId=35945927",
      source: "community_verified",
    });
    const loaded = loadCandidates(db!);
    const ditto = loaded.find((c) => c.id === "verified-newjeans-ditto");
    expect(ditto?.availability.melon.state).toBe("available");
    expect(ditto?.availability.melon.source).toBe("community_verified");
  });

  test("submission lifecycle: add -> list -> verify", () => {
    const db = getDb();
    const submission = addSubmission(db!, {
      artist: "NewJeans",
      title: "Ditto",
      platform: "melon",
      url: "https://www.melon.com/song/detail.htm?songId=35945927",
      note: "community test",
    });
    expect(submission.status).toBe("pending");

    const pending = listSubmissions(db!, "pending");
    expect(pending.some((s) => s.id === submission.id)).toBe(true);

    const verified = updateSubmissionStatus(db!, submission.id, "verified");
    expect(verified?.status).toBe("verified");
    expect(verified?.verified_at).toBeTruthy();

    const after = listSubmissions(db!, "verified");
    expect(after.some((s) => s.id === submission.id)).toBe(true);
  });
});
