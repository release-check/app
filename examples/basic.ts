import {
  ReleaseCheckClient,
  type ReleaseCheckCanonicalTrack,
  type ReleaseCheckPlatformAvailability,
} from "@release-check/sdk-js";

const VERIFIED_SPOTIFY_URL =
  "https://open.spotify.com/track/3r8RuvgbX9s7ammBn07D3W";

const baseUrl = process.env.RELEASE_CHECK_BASE_URL ?? "http://localhost:3000";
const client = new ReleaseCheckClient(baseUrl);

function formatCanonical(canonical: ReleaseCheckCanonicalTrack): string {
  const parts = [`${canonical.artist} — ${canonical.title}`];
  if (canonical.release) {
    parts.push(`(${canonical.release})`);
  }
  if (canonical.durationSeconds !== undefined) {
    parts.push(`[${canonical.durationSeconds}s]`);
  }
  if (canonical.isrc) {
    parts.push(`ISRC ${canonical.isrc}`);
  }
  return parts.join(" ");
}

function printAvailability(availability: ReleaseCheckPlatformAvailability): void {
  for (const platform of Object.keys(availability).sort()) {
    const entry = availability[platform as keyof ReleaseCheckPlatformAvailability];
    const details = [
      entry.url ? `url=${entry.url}` : null,
      entry.note ? `note=${entry.note}` : null,
      entry.region ? `region=${entry.region}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    console.log(`  ${platform}: ${entry.state}${details ? ` (${details})` : ""}`);
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function main(): Promise<void> {
  console.log(`ReleaseCheck API: ${baseUrl}\n`);

  const searchResult = await client.search("NewJeans Ditto");
  const top = searchResult.candidates[0];
  if (!top) {
    throw new Error("search returned no candidates");
  }

  console.log("Search — top candidate");
  console.log(`  canonical: ${formatCanonical(top.canonical)}`);
  console.log(`  confidence: ${top.confidence}`);

  const availabilityResult = await client.availability(
    top.canonical.artist,
    top.canonical.title,
  );
  if (!availabilityResult.availability) {
    throw new Error("availability returned no platform data");
  }

  console.log("\nAvailability");
  printAvailability(availabilityResult.availability);

  const resolveResult = await client.resolve(VERIFIED_SPOTIFY_URL);
  if (!resolveResult.candidate) {
    throw new Error(`resolve returned no candidate for ${VERIFIED_SPOTIFY_URL}`);
  }

  console.log("\nResolve — verified Spotify URL");
  console.log(`  url: ${VERIFIED_SPOTIFY_URL}`);
  console.log(`  canonical: ${formatCanonical(resolveResult.candidate.canonical)}`);
  console.log(`  confidence: ${resolveResult.candidate.confidence}`);
}

main().catch((error: unknown) => {
  console.error(`ReleaseCheck example failed: ${formatError(error)}`);
  process.exit(1);
});
