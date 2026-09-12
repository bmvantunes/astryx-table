import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
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

test("both child streams respect a slow shared output destination", () => {
  // Isolate the process-level output boundary from the Node test reporter.
  const fixture = `
    import assert from 'node:assert/strict';
    import {Writable} from 'node:stream';
    import {runBrowserValidation} from ${JSON.stringify(new URL("./test-browser.mjs", import.meta.url).href)};
    let bytes = 0;
    let writesWhileBlocked = 0;
    const initialDrainListeners = process.stdout.listenerCount('drain');
    const destination = new Writable({
      highWaterMark: 1,
      write(chunk, encoding, callback) {
        bytes += chunk.length;
        setTimeout(callback, 2);
      },
    });
    process.stdout.write = (...args) => {
      if (destination.writableNeedDrain) writesWhileBlocked++;
      return destination.write(...args);
    };
    destination.on('drain', () => process.stdout.emit('drain'));
    const child = "const block = Buffer.alloc(65536, 120); for (let i = 0; i < 16; i++) { process.stdout.write(block); process.stderr.write(block); }";
    assert.equal(await runBrowserValidation(process.execPath, ['-e', child]), 0);
    await new Promise(resolve => destination.end(resolve));
    assert.equal(bytes, 2 * 16 * 65536);
    assert.equal(writesWhileBlocked, 0);
    assert.equal(process.stdout.listenerCount('drain'), initialDrainListeners);
  `;
  execFileSync(process.execPath, ["--input-type=module", "-e", fixture], { timeout: 10_000 });
});

test("shutdown detection survives stream interleaving and long warning lines", () => {
  const fixtures = [
    [
      "process.stdout.write('close ti'); setTimeout(() => { process.stderr.write('other output'); setTimeout(() => process.stdout.write('med out'), 20); }, 20)",
      1,
    ],
    [
      "process.stdout.write('prevents '); setTimeout(() => process.stdout.write('x'.repeat(100000) + 'process from exiting'), 20)",
      1,
    ],
    [
      "process.stdout.write('close timed out'); setTimeout(() => process.stdout.write('x'.repeat(100000)), 20)",
      1,
    ],
    ["process.stdout.write('prevents x\\nprocess from exiting')", 0],
  ];
  const fixture = `
    import assert from 'node:assert/strict';
    import {runBrowserValidation} from ${JSON.stringify(new URL("./test-browser.mjs", import.meta.url).href)};
    process.stdout.write = () => true;
    for (const [source, expected] of ${JSON.stringify(fixtures)}) {
      assert.equal(await runBrowserValidation(process.execPath, ['-e', source]), expected);
    }
  `;
  execFileSync(process.execPath, ["--input-type=module", "-e", fixture], { timeout: 10_000 });
});

test("a destination that never drains cannot defeat the deadline", () => {
  const fixture = `
    import assert from 'node:assert/strict';
    import {runBrowserValidation} from ${JSON.stringify(new URL("./test-browser.mjs", import.meta.url).href)};
    const initialDrainListeners = process.stdout.listenerCount('drain');
    process.stdout.write = () => false;
    const child = "process.stdout.write('output'); setInterval(() => {}, 1000)";
    assert.equal(await runBrowserValidation(process.execPath, ['-e', child], 300), 1);
    assert.equal(process.stdout.listenerCount('drain'), initialDrainListeners);
  `;
  execFileSync(process.execPath, ["--input-type=module", "-e", fixture], { timeout: 5000 });
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  test(
    `cancellation with ${signal} cleans up the owned process group`,
    { skip: process.platform === "win32" },
    async (context) => {
      const source = `
      import {runBrowserValidation} from ${JSON.stringify(new URL("./test-browser.mjs", import.meta.url).href)};
      process.exitCode = await runBrowserValidation(process.execPath, ['-e', 'console.log(process.pid); setInterval(() => {}, 1000)']);
    `;
      const wrapper = spawn(process.execPath, ["--input-type=module", "-e", source], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let ownedPid;
      context.after(() => {
        wrapper.kill("SIGKILL");
        if (Number.isSafeInteger(ownedPid) && ownedPid > 0) {
          try {
            process.kill(-ownedPid, "SIGKILL");
          } catch (error) {
            if (error.code !== "ESRCH") throw error;
          }
        }
      });
      const [chunk] = await once(wrapper.stdout, "data");
      ownedPid = Number(chunk.toString().trim());
      assert.ok(Number.isSafeInteger(ownedPid) && ownedPid > 0);
      const exited = once(wrapper, "exit");
      wrapper.kill(signal);
      const [code] = await exited;
      assert.notEqual(code, 0);
      const deadline = performance.now() + 1500;
      let alive = true;
      while (alive && performance.now() < deadline) {
        try {
          process.kill(ownedPid, 0);
          await delay(20);
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
          alive = false;
        }
      }
      assert.equal(alive, false, "owned child survives wrapper cancellation");
    },
  );
}

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
