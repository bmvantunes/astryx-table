import { beforeAll } from "vite-plus/test";

import {
  ASTRYX_TABLE_CAPABLE_HARDWARE_PROFILE,
  installAstryxTableBenchmarkEnvironment,
} from "./internal/benchmark-profile";

beforeAll(() => {
  installAstryxTableBenchmarkEnvironment({
    browserEngine: ASTRYX_TABLE_CAPABLE_HARDWARE_PROFILE.requiredBrowserEngine,
    devicePixelRatio: window.devicePixelRatio,
    logicalProcessorCount: navigator.hardwareConcurrency,
    mode: import.meta.env.MODE,
    userAgent: navigator.userAgent,
    viewport: { height: window.innerHeight, width: window.innerWidth },
  });
});
