import apiServer from "../apps/api/src/index";
import { ReleaseCheckClient } from "../packages/rc-sdk-js/src/index";
import {
  assertGate,
  expectNegativeControl,
  runGate,
  validateSearchPayload,
} from "../verification/baseline";

await runGate("baseline_public_contract", async () => {
  const request = new Request("http://releasecheck.test/search?q=Angel");
  const response = await apiServer.fetch(request);
  const responseText = await response.text();
  const apiPayload = JSON.parse(responseText) as Record<string, unknown>;

  assertGate(response.status === 200, `public search returned HTTP ${response.status}`);
  validateSearchPayload(apiPayload);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
    apiServer.fetch(new Request(input, init))) as typeof fetch;

  let sdkPayload: unknown;
  try {
    sdkPayload = await new ReleaseCheckClient("http://releasecheck.test").search("Angel");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assertGate(
    JSON.stringify(sdkPayload) === JSON.stringify(apiPayload),
    "SDK response differs from public API response",
  );

  const uiSource = await Bun.file("apps/web/src/client.ts").text();
  for (const marker of [
    'new URL("/search", API_BASE)',
    "payload.candidates",
    "candidate.evidence",
    "candidate.availability",
  ]) {
    assertGate(uiSource.includes(marker), `UI contract marker missing: ${marker}`);
  }

  const invalidPayload = structuredClone(apiPayload) as {
    candidates: Array<Record<string, unknown>>;
  };
  if (invalidPayload.candidates[0]) {
    delete invalidPayload.candidates[0].evidence;
  }

  const negativeControl = expectNegativeControl("candidate_without_evidence", () =>
    validateSearchPayload(invalidPayload),
  );
  const rankedIds = (apiPayload.candidates as Array<{ id: string }>).map(({ id }) => id);

  return {
    measurements: {
      public_http_status: response.status,
      response_bytes: new TextEncoder().encode(responseText).byteLength,
      ranked_ids: rankedIds,
      api_sdk_runtime_equivalence: true,
      ui_search_contract_present: true,
      rust_correlation: "not_applicable_baseline",
    },
    negative_control: negativeControl,
    limitations: [
      "Baseline checks the current public HTTP, SDK, and UI contract only.",
      "Rust request/decision correlation becomes mandatory in the MusicBrainz vertical slice.",
    ],
  };
});
