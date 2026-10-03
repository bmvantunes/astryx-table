import { describe, expect, it } from "vite-plus/test";

import {
  ASTRYX_TABLE_CAPABLE_HARDWARE_PROFILE,
  ASTRYX_TABLE_CAPABLE_HARDWARE_SAMPLE_PROTOCOL,
  ASTRYX_TABLE_PRESENTATION_CADENCE_PROFILE,
  ASTRYX_TABLE_PRESENTATION_CADENCE_SAMPLE_PROTOCOL,
  getAstryxTableBenchmarkEnvironment,
  installAstryxTableBenchmarkEnvironment,
  validateAstryxTableBenchmarkEnvironment,
} from "./benchmark-profile";

const validEnvironment = {
  browserEngine: "chromium",
  devicePixelRatio: 1,
  logicalProcessorCount: 10,
  mode: "production",
  userAgent: "Mozilla/5.0 HeadlessChrome/145.0.0.0 Safari/537.36",
  viewport: { height: 900, width: 1440 },
} as const;

describe("AstryxTable capable-hardware benchmark profile", () => {
  it("retains one validated frozen Browser environment for benchmark evidence", () => {
    const installed = installAstryxTableBenchmarkEnvironment(validEnvironment);

    expect(getAstryxTableBenchmarkEnvironment()).toBe(installed);
    expect(installed).toEqual({
      ...validEnvironment,
      profile: "chromium-capable-hardware-v1",
    });
    expect(() =>
      installAstryxTableBenchmarkEnvironment({
        ...validEnvironment,
        userAgent: "Mozilla/5.0 HeadlessChrome/146.0.0.0 Safari/537.36",
      }),
    ).toThrow("benchmark environment is already installed with different evidence");
  });

  it("validates and freezes exact runtime evidence for the documented profile", () => {
    const evidence = validateAstryxTableBenchmarkEnvironment(validEnvironment);

    expect(evidence).toEqual({
      ...validEnvironment,
      profile: "chromium-capable-hardware-v1",
    });
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.viewport)).toBe(true);
    expect(ASTRYX_TABLE_CAPABLE_HARDWARE_PROFILE).toMatchObject({
      minimumLogicalProcessorCount: 8,
      requiredBrowserEngine: "chromium",
      requiredDevicePixelRatio: 1,
      requiredMode: "production",
      requiredViewport: { height: 900, width: 1440 },
    });
    expect(ASTRYX_TABLE_CAPABLE_HARDWARE_SAMPLE_PROTOCOL).toEqual({
      maximumDroppedFrameCount: 2,
      maximumDroppedFrameThresholdMs: 16.66,
      maximumP99Ms: 8.33,
      measuredSampleCount: 100,
      warmupSampleCount: 12,
    });
    expect(Object.isFrozen(ASTRYX_TABLE_CAPABLE_HARDWARE_SAMPLE_PROTOCOL)).toBe(true);
    expect(ASTRYX_TABLE_PRESENTATION_CADENCE_PROFILE).toBe(
      "chromium-production-presentation-cadence-v1",
    );
    expect(ASTRYX_TABLE_PRESENTATION_CADENCE_SAMPLE_PROTOCOL).toEqual({
      maximumDroppedFrameCount: 2,
      maximumDroppedFrameThresholdMs: 20,
      maximumP99Ms: 20,
      measuredSampleCount: 100,
      warmupSampleCount: 12,
    });
    expect(Object.isFrozen(ASTRYX_TABLE_PRESENTATION_CADENCE_SAMPLE_PROTOCOL)).toBe(true);
  });

  it.each([
    [{ ...validEnvironment, browserEngine: "firefox" }, "requires browser engine chromium"],
    [{ ...validEnvironment, mode: "test" }, "requires mode production"],
    [{ ...validEnvironment, viewport: { height: 720, width: 1280 } }, "requires viewport 1440x900"],
    [{ ...validEnvironment, devicePixelRatio: 2 }, "requires devicePixelRatio 1"],
    [{ ...validEnvironment, logicalProcessorCount: 7 }, "requires at least 8 logical processors"],
    [
      { ...validEnvironment, userAgent: "Mozilla/5.0 Firefox/145.0" },
      "requires a Chromium user agent",
    ],
    [
      { ...validEnvironment, userAgent: ` ${validEnvironment.userAgent}` },
      "requires a normalized non-empty user agent",
    ],
    [{ ...validEnvironment, userAgent: "" }, "requires a normalized non-empty user agent"],
  ] as const)("rejects runtime evidence outside the profile", (environment, message) => {
    expect(() => validateAstryxTableBenchmarkEnvironment(environment)).toThrow(message);
  });
});
