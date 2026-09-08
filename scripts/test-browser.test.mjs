import assert from "node:assert/strict";
import { test } from "node:test";
import { runBrowserValidation } from "./test-browser.mjs";

test("a zero exit with a shutdown warning fails", async () => {
  assert.equal(
    await runBrowserValidation(process.execPath, [
      "-e",
      "console.log('close timed out after 10000ms')",
    ]),
    1,
  );
});

test("a successful child exits cleanly", async () => {
  assert.equal(await runBrowserValidation(process.execPath, ["-e", "process.exit(0)"]), 0);
});

test(
  "a descendant holding inherited pipes cannot defeat the deadline",
  { timeout: 5000 },
  async () => {
    const start = performance.now();
    const fixture =
      "const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'}); child.unref(); process.exit(0)";
    assert.equal(await runBrowserValidation(process.execPath, ["-e", fixture], 300), 1);
    assert.ok(performance.now() - start < 3000);
  },
);
