import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

// Command boundary: a zero exit with a shutdown warning is still a failed run.
export function runBrowserValidation(command, args, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const deadline = setTimeout(() => {
      console.error("Browser validation exceeded its process deadline.");
      // Fail immediately, not only after descendants release their pipe handles.
      resolve(1);
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
    }, timeoutMs);
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (chunk) => {
        output += chunk.toString();
        process.stdout.write(chunk);
      });
    }
    child.on("error", (error) => {
      clearTimeout(deadline);
      console.error(error);
      resolve(1);
    });
    child.on("close", (code) => {
      clearTimeout(deadline);
      const failed = code !== 0 || /close timed out|prevents .*process from exiting/.test(output);
      if (failed) console.error("Browser validation failed, including runner shutdown.");
      resolve(failed ? 1 : 0);
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
