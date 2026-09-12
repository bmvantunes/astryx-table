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
    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      releaseOutput();
      process.removeListener("SIGINT", cancel);
      process.removeListener("SIGTERM", cancel);
      resolve(code);
    };
    let shutdownWarning = false;
    const abort = () => {
      if (settled) return;
      // Fail immediately, not only after descendants release their pipe handles.
      finish(1);
      if (child.pid) {
        if (process.platform === "win32") {
          const cleanup = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
            stdio: "ignore",
          });
          cleanup.on("error", () => child.kill("SIGKILL"));
          cleanup.unref();
        } else {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch (error) {
            if (error.code !== "ESRCH") console.error(error);
          }
        }
      }
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
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
      finish(1);
    });
    child.on("close", (code) => {
      if (settled) return;
      const failed = code !== 0 || shutdownWarning;
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
