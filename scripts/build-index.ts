import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { DEMO_INDEX } from "../apps/api/src/demo-index";
import { VERIFIED_INDEX } from "../apps/api/src/verified-index";
import { buildSyntheticCandidates } from "../apps/api/src/synthetic-fixtures";

const outputPath = new URL("../data/cache/demo-index.json", import.meta.url);
const candidates = [
  ...DEMO_INDEX.map((candidate) => ({
    ...candidate,
    sample: {
      origin: "handwritten_demo" as const,
      scene: "demo",
      messyCase: candidate.ambiguity.length > 0,
      verified: true,
    },
  })),
  ...VERIFIED_INDEX,
  ...buildSyntheticCandidates(),
];

mkdirSync(dirname(outputPath.pathname), { recursive: true });
await Bun.write(outputPath, `${JSON.stringify(candidates, null, 2)}\n`);

const messyCaseCount = candidates.filter((candidate) => candidate.sample.messyCase).length;
const handwrittenCount = DEMO_INDEX.length + VERIFIED_INDEX.length;

console.log(
  JSON.stringify(
    {
      output: outputPath.pathname,
      candidateCount: candidates.length,
      handwrittenCount,
      syntheticCount: candidates.length - handwrittenCount,
      verifiedCount: handwrittenCount,
      messyCaseCount,
    },
    null,
    2,
  ),
);
