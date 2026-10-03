import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  performanceContext,
  repository,
  validatePerformanceEvidence,
} from "./performance-evidence.mjs";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const pullRequest = process.argv[2];
if (!/^\d+$/.test(pullRequest ?? "")) throw new Error("Provide the pull request number.");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
function api(path, body) {
  return JSON.parse(
    execFileSync("gh", ["api", path, ...(body ? ["--input", "-"] : [])], {
      encoding: "utf8",
      input: body ? JSON.stringify(body) : undefined,
    }),
  );
}
const commit = git("rev-parse", "HEAD");
if (git("status", "--porcelain"))
  throw new Error("Commit all changes before publishing performance evidence.");
const report = JSON.parse(readFileSync("test-results/performance.json", "utf8"));
const evidence = validatePerformanceEvidence(report, commit);
if (api("user").login !== "bmvantunes")
  throw new Error("The repository owner must attest capable-hardware evidence.");
const pull = api(`repos/${repository}/pulls/${pullRequest}`);
if (pull.head.sha !== commit && !(pull.merged === true && pull.merge_commit_sha === commit))
  throw new Error("Neither the pull request head nor its merged commit matches the measurement.");
const body = `## Capable-hardware performance evidence\n\nMeasured commit: \`${commit}\`. Clean checkout before and after the production Browser run.\n\nCommand: \`vp run test:browser:performance\`. The raw Client scenarios preserve the inherited profile, 12 warmups, 100 measured samples and complete React/callback accounting. This does not certify deferred capabilities.\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``;
const comment = api(`repos/${repository}/issues/${pullRequest}/comments`, { body });
api(`repos/${repository}/statuses/${commit}`, {
  state: "success",
  context: performanceContext,
  target_url: comment.html_url,
  description: `${evidence.length} production scenarios passed on capable hardware; exact clean commit.`,
});
console.log(comment.html_url);
