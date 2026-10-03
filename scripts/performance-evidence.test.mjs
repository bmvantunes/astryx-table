import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePerformanceEvidence, validatePerformanceStatus } from "./performance-evidence.mjs";

const commit = "a".repeat(40);
function report() {
  const environment = {
    profile: "chromium-capable-hardware-v1",
    browserEngine: "chromium",
    mode: "production",
    devicePixelRatio: 1,
    logicalProcessorCount: 8,
    viewport: { width: 1440, height: 900 },
    userAgent: "HeadlessChrome/148.0.0.0",
  };
  return {
    version: 1,
    commit,
    startCommit: commit,
    clean: true,
    startedClean: true,
    reason: "passed",
    unhandledErrors: 0,
    tests: [
      {
        state: "passed",
        evidence: [
          {
            evidence: [
              [
                "client-raw-two-axis-custom-renderer-work-5000x150",
                "chromium-capable-hardware-v1",
                8.33,
                16.66,
              ],
              [
                "client-raw-two-axis-presentation-cadence-5000x150",
                "chromium-production-presentation-cadence-v1",
                20,
                20,
              ],
              [
                "client-live-publication-5000x150-20hz",
                "chromium-capable-hardware-v1",
                8.33,
                16.66,
              ],
            ].map(([scenario, profile, budget, thresholdMs]) => ({
              scenario,
              profile,
              environment,
              summary: {
                budget,
                sampleCount: 100,
                min: 1,
                p50: 2,
                p95: 3,
                p99: 4,
                max: 5,
                overBudgetSampleCount: 0,
              },
              droppedFrames: { count: 0, maxCount: 2, thresholdMs },
            })),
          },
        ],
      },
    ],
  };
}
test("accepts complete evidence for the exact clean commit", () => {
  assert.equal(validatePerformanceEvidence(report(), commit).length, 3);
});
for (const [name, change] of [
  [
    "stale commit",
    (r) => {
      r.commit = "b".repeat(40);
    },
  ],
  [
    "checkout changed during run",
    (r) => {
      r.startCommit = "b".repeat(40);
    },
  ],
  [
    "dirty start",
    (r) => {
      r.startedClean = false;
    },
  ],
  [
    "dirty finish",
    (r) => {
      r.clean = false;
    },
  ],
  [
    "failed run",
    (r) => {
      r.reason = "failed";
    },
  ],
  [
    "unhandled error",
    (r) => {
      r.unhandledErrors = 1;
    },
  ],
  [
    "skipped test",
    (r) => {
      r.tests[0].state = "skipped";
    },
  ],
  [
    "missing scenario",
    (r) => {
      r.tests[0].evidence[0].evidence.pop();
    },
  ],
  [
    "duplicate scenario",
    (r) => {
      r.tests[0].evidence[0].evidence.push(r.tests[0].evidence[0].evidence[0]);
    },
  ],
  [
    "underpowered host",
    (r) => {
      r.tests[0].evidence[0].evidence[0].environment.logicalProcessorCount = 4;
    },
  ],
  [
    "development runtime",
    (r) => {
      r.tests[0].evidence[0].evidence[0].environment.mode = "development";
    },
  ],
  [
    "insufficient samples",
    (r) => {
      r.tests[0].evidence[0].evidence[0].summary.sampleCount = 99;
    },
  ],
  [
    "weakened budget",
    (r) => {
      r.tests[0].evidence[0].evidence[0].summary.budget = 20;
    },
  ],
  [
    "failed p99",
    (r) => {
      r.tests[0].evidence[0].evidence[0].summary.p99 = 9;
    },
  ],
  [
    "nonfinite timing",
    (r) => {
      r.tests[0].evidence[0].evidence[0].summary.p99 = NaN;
    },
  ],
  [
    "dropped frames",
    (r) => {
      r.tests[0].evidence[0].evidence[0].droppedFrames.count = 3;
    },
  ],
])
  test(`rejects ${name}`, () => {
    const r = report();
    change(r);
    assert.throws(() => validatePerformanceEvidence(r, commit));
  });

test("only accepts a successful owner attestation with a repository evidence link", () => {
  const status = {
    context: "performance/capable-hardware",
    creator: { login: "bmvantunes" },
    state: "success",
    target_url: "https://github.com/bmvantunes/astryx-table/pull/18#issuecomment-123",
  };
  assert.equal(validatePerformanceStatus([status]), true);
  assert.equal(validatePerformanceStatus([]), false);
  assert.equal(validatePerformanceStatus([{ ...status, state: "pending" }]), false);
  assert.throws(() =>
    validatePerformanceStatus([{ ...status, creator: { login: "someone-else" } }]),
  );
  assert.throws(() => validatePerformanceStatus([{ ...status, state: "failure" }]));
  assert.throws(() =>
    validatePerformanceStatus([{ ...status, target_url: "https://example.com" }]),
  );
});
