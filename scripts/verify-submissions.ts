/**
 * Community submission verification.
 *
 * For each pending submission:
 *   1. Find the matching indexed track (normalized artist+title).
 *   2. If found -> upsert the availability entry (source=community_verified)
 *      and mark the submission verified.
 *   3. If not found -> report as pending (needs MusicBrainz identity review);
 *      never auto-create tracks from bare submissions.
 *
 * Usage: RELEASE_CHECK_DB=/path/to.db bun run scripts/verify-submissions.ts
 */
import { getSearchIndex } from "../apps/api/src/search-index";
import { normalize } from "../apps/api/src/demo-index";
import {
  getDb,
  listSubmissions,
  updateSubmissionStatus,
  upsertAvailability,
} from "../apps/api/src/storage";
import { PLATFORMS, type Platform } from "../apps/api/src/types";

const database = getDb();
if (!database) {
  console.error("persistence disabled — set RELEASE_CHECK_DB");
  process.exit(2);
}

const pending = listSubmissions(database, "pending");
const index = getSearchIndex();
const byKey = new Map(
  index.map((candidate) => [
    `${normalize(candidate.canonical.artist)}|${normalize(candidate.canonical.title)}`,
    candidate.id,
  ]),
);

const results: Array<{ id: number; artist: string; title: string; platform: string; outcome: string }> = [];

for (const submission of pending) {
  const key = `${normalize(submission.artist)}|${normalize(submission.title)}`;
  const trackId = byKey.get(key);

  if (!trackId) {
    results.push({
      id: submission.id,
      artist: submission.artist,
      title: submission.title,
      platform: submission.platform,
      outcome: "pending (no indexed track — needs MusicBrainz identity review)",
    });
    continue;
  }

  upsertAvailability(database, trackId, submission.platform as Platform, {
    state: "available",
    url: submission.url,
    note: `community-verified link (submission #${submission.id})`,
    source: "community_verified",
  });
  updateSubmissionStatus(database, submission.id, "verified");
  results.push({
    id: submission.id,
    artist: submission.artist,
    title: submission.title,
    platform: submission.platform,
    outcome: `verified -> ${trackId}`,
  });
}

const verifiedCount = results.filter((r) => r.outcome.startsWith("verified")).length;
console.log(
  JSON.stringify(
    {
      pendingTotal: pending.length,
      verified: verifiedCount,
      needsReview: results.length - verifiedCount,
      results,
      platforms: PLATFORMS,
    },
    null,
    2,
  ),
);
