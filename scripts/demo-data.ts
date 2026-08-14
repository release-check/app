import { DEMO_INDEX } from "../apps/api/src/demo-index";
import { getSearchIndex, getSearchIndexStats } from "../apps/api/src/search-index";

const goldenSet = await Bun.file("data/golden-set.json").json();
const evaluationSet = await Bun.file("data/evaluation-set.json").json();
const searchIndex = getSearchIndex();

console.log(
  JSON.stringify(
    {
      indexStats: getSearchIndexStats(),
      handwrittenCandidates: DEMO_INDEX,
      syntheticPreview: searchIndex
        .filter((candidate) => candidate.sample?.origin === "synthetic_load")
        .slice(0, 5),
      goldenSet,
      evaluationSet,
    },
    null,
    2,
  ),
);
