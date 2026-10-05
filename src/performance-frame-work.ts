/** Combine measured CPU without assuming that React ran inside a RAF callback. */
export function sumProductionFrameWork(
  callbackDurationMs: number,
  reactDurationMs: number,
): number {
  // Without interval evidence, overlap is unknown. Conservative double counting
  // is preferable to silently dropping independent React work.
  return callbackDurationMs + reactDurationMs;
}

export function sumProductionSampleWork(
  sample: Readonly<{
    admissionDurationMs: number;
    renderedFrame: Readonly<{ callbackDurationMs: number; reactDurationMs: number }>;
    presentationFrame: Readonly<{ callbackDurationMs: number; reactDurationMs: number }>;
  }>,
): number {
  return (
    sample.admissionDurationMs +
    sumProductionFrameWork(
      sample.renderedFrame.callbackDurationMs,
      sample.renderedFrame.reactDurationMs,
    ) +
    sumProductionFrameWork(
      sample.presentationFrame.callbackDurationMs,
      sample.presentationFrame.reactDurationMs,
    )
  );
}
