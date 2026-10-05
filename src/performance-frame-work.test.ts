import { expect, test } from "vite-plus/test";
import { assertAstryxTableBenchmarkBudget } from "../packages/table/src/internal/benchmark-budget";
import { sumProductionFrameWork, sumProductionSampleWork } from "./performance-frame-work";

const options = { budgetMs: 8.33, warmupSampleCount: 12, measuredSampleCount: 100 };
const enforce = (work: number) =>
  assertAstryxTableBenchmarkBudget(
    "independent CPU",
    Array.from({ length: 112 }, () => work),
    options,
  );

test("separate geometry and React work cannot incorrectly pass the frame gate", () => {
  expect(() => enforce(sumProductionFrameWork(6, 3))).toThrow("exceeded the frame reference");
});

test("admission and independent React work across both phases remain charged", () => {
  const work = sumProductionSampleWork({
    admissionDurationMs: 0.5,
    renderedFrame: { callbackDurationMs: 4, reactDurationMs: 3 },
    presentationFrame: { callbackDurationMs: 2, reactDurationMs: 0 },
  });
  expect(() => enforce(work)).toThrow("exceeded the frame reference");
});

test("conservatively combined work inside the budget still passes", () => {
  expect(() => enforce(sumProductionFrameWork(3, 2))).not.toThrow();
});
