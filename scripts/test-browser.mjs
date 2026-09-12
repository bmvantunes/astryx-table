import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { pathToFileURL } from "node:url";

// Command boundary: a zero exit with a shutdown warning is still a failed run.
export function runBrowserValidation(command, args, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const streams = [child.stdout, child.stderr];
    let waitingForDrain = false;
    const resume = () => {
      waitingForDrain = false;
      for (const stream of streams) {
        if (waitingForDrain) break;
        stream.resume();
      }
    };
    const releaseOutput = () => {
      process.stdout.removeListener("drain", resume);
      waitingForDrain = false;
    };
    let settled = false;
    let cleanupDeadline;
    let cleanupProcess;
    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearTimeout(cleanupDeadline);
      releaseOutput();
      process.removeListener("SIGINT", cancel);
      process.removeListener("SIGTERM", cancel);
      resolve(code);
    };
    let shutdownWarning = false;
    let aborting = false;
    let cleanupComplete = false;
    const finishAbort = () => {
      if (cleanupComplete && (!child.pid || child.exitCode !== null || child.signalCode !== null)) {
        finish(1);
      }
    };
    const killDirectChild = () => {
      try {
        child.kill("SIGKILL");
      } catch (error) {
        console.error(error);
      }
    };
    const abort = () => {
      if (settled || aborting) return;
      aborting = true;
      clearTimeout(deadline);
      releaseOutput();
      cleanupDeadline = setTimeout(() => {
        console.error(
          "Browser cleanup exceeded its deadline; process-tree cleanup is unconfirmed.",
        );
        killDirectChild();
        if (cleanupProcess) {
          try {
            cleanupProcess.kill("SIGKILL");
          } catch (error) {
            console.error(error);
          }
          cleanupProcess.unref();
        }
        // An OS refusal must fail the command rather than hang the runner.
        // Normal cleanup remains referenced until the direct child is reaped.
        child.unref();
        finish(1);
      }, 5000);
      // Reap the direct child before settling, but do not wait for descendants
      // to release inherited pipes. Those pipes are destroyed below.
      const awaitingExit = child.pid && child.exitCode === null && child.signalCode === null;
      if (awaitingExit) child.once("exit", finishAbort);
      if (child.pid) {
        if (process.platform === "win32") {
          const cleanup = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
            stdio: "ignore",
          });
          cleanupProcess = cleanup;
          let fallbackStarted = false;
          const fallback = () => {
            if (fallbackStarted) return;
            fallbackStarted = true;
            console.error("Browser process-tree cleanup failed; attempting direct-child cleanup.");
            killDirectChild();
          };
          cleanup.on("error", fallback);
          cleanup.once("close", (code) => {
            if (code !== 0) fallback();
            cleanupComplete = true;
            finishAbort();
          });
        } else {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch (error) {
            if (error.code !== "ESRCH") {
              console.error(error);
              killDirectChild();
            }
          }
          cleanupComplete = true;
        }
      } else {
        cleanupComplete = true;
      }
      child.stdout.destroy();
      child.stderr.destroy();
      finishAbort();
    };
    const cancel = () => {
      console.error("Browser validation was cancelled.");
      abort();
    };
    const deadline = setTimeout(() => {
      console.error("Browser validation exceeded its process deadline.");
      abort();
    }, timeoutMs);
    process.on("SIGINT", cancel);
    process.on("SIGTERM", cancel);
    for (const stream of streams) {
      const decoder = new StringDecoder("utf8");
      // Retain only enough suffix to recognize a split literal. A separate flag
      // preserves the unbounded `.*` in "prevents .*process from exiting".
      let suffix = "";
      let prevents = false;
      stream.on("data", (chunk) => {
        if (waitingForDrain) {
          // Child-process pipe cleanup can resume a stream after child exit.
          // Keep that chunk in the readable buffer until the shared sink drains.
          stream.pause();
          stream.unshift(chunk);
          return;
        }
        const lines = decoder.write(chunk).split(/[\r\n\u2028\u2029]/);
        for (const [index, line] of lines.entries()) {
          if (index > 0) {
            suffix = "";
            prevents = false;
          }
          const text = suffix + line;
          shutdownWarning ||=
            /close timed out|prevents .*process from exiting/.test(text) ||
            (prevents && text.includes("process from exiting"));
          prevents ||= text.includes("prevents ");
          suffix = text.slice(-19);
        }
        if (!process.stdout.write(chunk) && !waitingForDrain) {
          waitingForDrain = true;
          for (const source of streams) source.pause();
          process.stdout.once("drain", resume);
        }
      });
    }
    child.on("error", (error) => {
      console.error(error);
      if (!aborting) finish(1);
    });
    child.on("close", (code) => {
      if (settled) return;
      if (aborting) {
        finishAbort();
        return;
      }
      const failed = aborting || code !== 0 || shutdownWarning;
      if (failed) console.error("Browser validation failed, including runner shutdown.");
      finish(failed ? 1 : 0);
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runBrowserValidation("vp", [
    "test",
    "--config",
    "vitest.browser.config.ts",
    "--run",
  ]);
}
