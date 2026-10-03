import { execFileSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import {
  repository,
  performanceContext,
  validatePerformanceStatus,
  validatePerformanceEvidence,
} from "./performance-evidence.mjs";

const commit = process.env.PERFORMANCE_HEAD_SHA;
if (!/^[a-f0-9]{40}$/.test(commit ?? ""))
  throw new Error("PERFORMANCE_HEAD_SHA must identify the exact PR or push head.");
// A new push may reach CI before the local clean-commit benchmark completes.
for (let attempt = 0; attempt < 30; attempt++) {
  const statuses = JSON.parse(
    execFileSync("gh", ["api", `repos/${repository}/commits/${commit}/statuses?per_page=100`], {
      encoding: "utf8",
    }),
  );
  if (validatePerformanceStatus(statuses)) {
    const status = statuses.find((entry) => entry.context === performanceContext);
    const commentId = status.target_url.split("#issuecomment-")[1];
    const comment = JSON.parse(
      execFileSync("gh", ["api", `repos/${repository}/issues/comments/${commentId}`], {
        encoding: "utf8",
      }),
    );
    if (comment.user?.login !== "bmvantunes" || comment.html_url !== status.target_url)
      throw new Error("Performance report is not an owner-authored repository attestation.");
    const encoded = comment.body.match(/```json\n([\s\S]*?)\n```/u)?.[1];
    if (!encoded) throw new Error("Performance attestation lacks its structured report.");
    validatePerformanceEvidence(JSON.parse(encoded), commit);
    console.log(`Verified capable-hardware performance attestation and report for ${commit}.`);
    process.exit(0);
  }
  await setTimeout(20_000);
}
throw new Error(
  `No successful capable-hardware performance attestation for ${commit}. Run the benchmark from that clean commit and publish its evidence.`,
);
