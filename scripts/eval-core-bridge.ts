import {
  coreInputFromCandidatePair,
  matchWithRustCore,
} from "../apps/api/src/core-bridge";
import { getSearchIndex } from "../apps/api/src/search-index";

const candidates = getSearchIndex();
const source = candidates.find((candidate) => candidate.id === "demo-dj-python-angel");
const liveDemo = candidates.find((candidate) => candidate.id === "demo-dj-python-angel-live-demo");

if (!source || !liveDemo) {
  throw new Error("missing demo candidates for core bridge evaluation");
}

const response = await matchWithRustCore(coreInputFromCandidatePair(source, liveDemo));
const decision = response.decisions[0];

if (!decision) {
  throw new Error("Rust core returned no decisions");
}

if (!["false_positive", "possible_match", "rejected"].includes(decision.status)) {
  throw new Error(`expected visible non-exact decision status, got ${decision.status}`);
}

if (decision.evidence.length === 0) {
  throw new Error("Rust core decision did not include evidence");
}

console.log(
  JSON.stringify(
    {
      status: decision.status,
      confidence: decision.confidence,
      evidenceCount: decision.evidence.length,
    },
    null,
    2,
  ),
);
