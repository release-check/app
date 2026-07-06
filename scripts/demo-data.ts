import { DEMO_INDEX } from "../apps/api/src/demo-index";

const goldenSet = await Bun.file("data/golden-set.json").json();
const evaluationSet = await Bun.file("data/evaluation-set.json").json();

console.log(
  JSON.stringify(
    {
      candidates: DEMO_INDEX,
      goldenSet,
      evaluationSet,
    },
    null,
    2,
  ),
);
