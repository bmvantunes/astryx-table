export const performanceContext = "performance/capable-hardware";
export const repository = "bmvantunes/astryx-table";
const scenarios = new Map([
  [
    "client-filters-two-axis-custom-renderer-work-5000x150",
    ["chromium-capable-hardware-v1", 8.33, 16.66],
  ],
  [
    "client-filters-two-axis-presentation-cadence-5000x150",
    ["chromium-production-presentation-cadence-v1", 20, 20],
  ],
  [
    "client-open-filter-live-publication-5000x150-20hz",
    ["chromium-capable-hardware-v1", 8.33, 16.66],
  ],
  [
    "client-held-arrow-down-input-through-render-work-5000x150-pinned",
    ["chromium-capable-hardware-v1", 8.33, 16.66, 200],
  ],
  [
    "client-held-arrow-down-presentation-frame-cadence-5000x150-pinned",
    ["chromium-production-presentation-cadence-v1", 20, 20, 200],
  ],
  [
    "client-held-arrow-down-two-repeats-per-frame-work-5000x150-pinned",
    ["chromium-capable-hardware-v1", 8.33, 16.66, 200],
  ],
  [
    "client-held-arrow-down-two-repeats-per-presentation-frame-cadence-5000x150-pinned",
    ["chromium-production-presentation-cadence-v1", 20, 20, 200],
  ],
  [
    "client-held-arrow-right-input-through-render-work-5000x150-pinned",
    ["chromium-capable-hardware-v1", 8.33, 16.66, 200],
  ],
  [
    "client-held-arrow-right-presentation-frame-cadence-5000x150-pinned",
    ["chromium-production-presentation-cadence-v1", 20, 20, 200],
  ],

  [
    "client-raw-two-axis-custom-renderer-work-5000x150",
    ["chromium-capable-hardware-v1", 8.33, 16.66],
  ],
  [
    "client-raw-two-axis-presentation-cadence-5000x150",
    ["chromium-production-presentation-cadence-v1", 20, 20],
  ],
  [
    "client-pinned-two-axis-custom-renderer-work-5000x150",
    ["chromium-capable-hardware-v1", 8.33, 16.66],
  ],
  [
    "client-pinned-two-axis-presentation-cadence-5000x150",
    ["chromium-production-presentation-cadence-v1", 20, 20],
  ],
  ["client-resize-start-work-5000x150", ["chromium-capable-hardware-v1", 8.33, 16.66]],
  ["client-resize-end-work-5000x150", ["chromium-capable-hardware-v1", 8.33, 16.66]],
  [
    "client-resize-start-presentation-cadence-5000x150",
    ["chromium-production-presentation-cadence-v1", 20, 20],
  ],
  [
    "client-resize-end-presentation-cadence-5000x150",
    ["chromium-production-presentation-cadence-v1", 20, 20],
  ],
  ["client-reorder-preview-work-5000x150", ["chromium-capable-hardware-v1", 8.33, 16.66]],
  [
    "client-reorder-preview-presentation-cadence-5000x150",
    ["chromium-production-presentation-cadence-v1", 20, 20],
  ],
  ["client-reorder-autoscroll-work-5000x150", ["chromium-capable-hardware-v1", 8.33, 16.66]],
  [
    "client-reorder-autoscroll-presentation-cadence-5000x150",
    ["chromium-production-presentation-cadence-v1", 20, 20],
  ],
  ["client-live-publication-5000x150-20hz", ["chromium-capable-hardware-v1", 8.33, 16.66]],
]);
function requireEvidence(condition, message) {
  if (!condition) throw new Error(`Invalid performance evidence: ${message}`);
}
export function validatePerformanceEvidence(report, commit) {
  requireEvidence(/^[a-f0-9]{40}$/.test(commit), "expected an exact commit SHA");
  requireEvidence(
    report?.version === 1 && report.commit === commit && report.startCommit === commit,
    "commit changed or does not match",
  );
  requireEvidence(
    report.clean === true && report.startedClean === true,
    "working tree was not clean before and after the run",
  );
  requireEvidence(
    report.reason === "passed" && report.unhandledErrors === 0,
    "run did not pass completely",
  );
  requireEvidence(
    Array.isArray(report.tests) &&
      report.tests.length > 0 &&
      report.tests.every((test) => test.state === "passed"),
    "missing, failed or skipped tests",
  );
  const evidence = report.tests.flatMap((test) =>
    test.evidence.flatMap((entry) =>
      Array.isArray(entry.evidence) ? entry.evidence : [entry.evidence],
    ),
  );
  const seen = new Set();
  for (const entry of evidence) {
    const protocol = scenarios.get(entry.scenario);
    requireEvidence(protocol && !seen.has(entry.scenario), "unknown or duplicate scenario");
    seen.add(entry.scenario);
    const [profile, budget, threshold, sampleCount = 100] = protocol;
    const env = entry.environment;
    requireEvidence(
      env?.profile === "chromium-capable-hardware-v1" &&
        env.browserEngine === "chromium" &&
        env.mode === "production" &&
        env.devicePixelRatio === 1 &&
        env.viewport?.width === 1440 &&
        env.viewport?.height === 900 &&
        Number.isSafeInteger(env.logicalProcessorCount) &&
        env.logicalProcessorCount >= 8 &&
        /(?:Headless)?Chrome\//u.test(env.userAgent),
      "incompatible Browser environment",
    );
    const summary = entry.summary;
    requireEvidence(
      entry.profile === profile &&
        summary?.budget === budget &&
        summary.sampleCount === sampleCount,
      "profile, budget or sample count differs",
    );
    const timings = [summary.min, summary.p50, summary.p95, summary.p99, summary.max];
    requireEvidence(
      timings.every(
        (value, index) =>
          Number.isFinite(value) && value >= 0 && (index === 0 || value >= timings[index - 1]),
      ) && summary.p99 <= budget,
      "invalid timings or failed p99",
    );
    requireEvidence(
      Number.isSafeInteger(summary.overBudgetSampleCount) &&
        summary.overBudgetSampleCount >= 0 &&
        summary.overBudgetSampleCount <= summary.sampleCount,
      "invalid over-budget sample count",
    );
    const dropped = entry.droppedFrames;
    requireEvidence(
      dropped?.thresholdMs === threshold &&
        dropped.maxCount === 2 &&
        Number.isSafeInteger(dropped.count) &&
        dropped.count >= 0 &&
        dropped.count <= 2,
      "dropped-frame contract failed",
    );
  }
  requireEvidence(seen.size === scenarios.size, "required scenario is missing");
  return evidence;
}

// GitHub returns statuses newest first. Never accept an older success beneath a failure.
export function validatePerformanceStatus(statuses) {
  const status = statuses.find((entry) => entry.context === performanceContext);
  if (!status || status.state === "pending") return false;
  requireEvidence(
    status.creator?.login === "bmvantunes",
    "attestation is not from the repository owner",
  );
  requireEvidence(status.state === "success", "latest capable-hardware run failed");
  requireEvidence(
    /^https:\/\/github\.com\/bmvantunes\/astryx-table\/pull\/\d+#issuecomment-\d+$/.test(
      status.target_url,
    ),
    "attestation lacks a repository evidence link",
  );
  return true;
}
