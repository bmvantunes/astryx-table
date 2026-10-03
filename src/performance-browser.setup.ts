import { beforeAll } from "vite-plus/test";
import { installAstryxTableBenchmarkEnvironment } from "../packages/table/src/internal/benchmark-profile";
beforeAll(() => {
  installAstryxTableBenchmarkEnvironment({
    browserEngine: "chromium",
    devicePixelRatio: window.devicePixelRatio,
    logicalProcessorCount: navigator.hardwareConcurrency,
    mode: import.meta.env.MODE,
    userAgent: navigator.userAgent,
    viewport: { height: window.innerHeight, width: window.innerWidth },
  });
});
