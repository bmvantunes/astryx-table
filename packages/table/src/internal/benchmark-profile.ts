export type AstryxTableCapableHardwareProfile = Readonly<{
  readonly id: "chromium-capable-hardware-v1";
  readonly minimumLogicalProcessorCount: 8;
  readonly requiredBrowserEngine: "chromium";
  readonly requiredDevicePixelRatio: 1;
  readonly requiredMode: "production";
  readonly requiredViewport: Readonly<{ readonly height: 900; readonly width: 1440 }>;
}>;

export const ASTRYX_TABLE_CAPABLE_HARDWARE_PROFILE: AstryxTableCapableHardwareProfile = Object.freeze(
  {
    id: "chromium-capable-hardware-v1",
    minimumLogicalProcessorCount: 8,
    requiredBrowserEngine: "chromium",
    requiredDevicePixelRatio: 1,
    requiredMode: "production",
    requiredViewport: Object.freeze({ height: 900, width: 1440 }),
  },
);

export type AstryxTableCapableHardwareSampleProtocol = Readonly<{
  readonly maximumDroppedFrameCount: 2;
  readonly maximumDroppedFrameThresholdMs: 16.66;
  readonly maximumP99Ms: 8.33;
  readonly measuredSampleCount: 100;
  readonly warmupSampleCount: 12;
}>;

export const ASTRYX_TABLE_CAPABLE_HARDWARE_SAMPLE_PROTOCOL: AstryxTableCapableHardwareSampleProtocol =
  Object.freeze({
    maximumDroppedFrameCount: 2,
    maximumDroppedFrameThresholdMs: 16.66,
    maximumP99Ms: 8.33,
    measuredSampleCount: 100,
    warmupSampleCount: 12,
  });

export const ASTRYX_TABLE_PRESENTATION_CADENCE_PROFILE =
  "chromium-production-presentation-cadence-v1" as const;

export type AstryxTableBenchmarkProfile =
  | AstryxTableCapableHardwareProfile["id"]
  | typeof ASTRYX_TABLE_PRESENTATION_CADENCE_PROFILE;

export type AstryxTablePresentationCadenceSampleProtocol = Readonly<{
  readonly maximumDroppedFrameCount: 2;
  readonly maximumDroppedFrameThresholdMs: 20;
  readonly maximumP99Ms: 20;
  readonly measuredSampleCount: 100;
  readonly warmupSampleCount: 12;
}>;

export const ASTRYX_TABLE_PRESENTATION_CADENCE_SAMPLE_PROTOCOL: AstryxTablePresentationCadenceSampleProtocol =
  Object.freeze({
    maximumDroppedFrameCount: 2,
    maximumDroppedFrameThresholdMs: 20,
    maximumP99Ms: 20,
    measuredSampleCount: 100,
    warmupSampleCount: 12,
  });

type AstryxTableBenchmarkEnvironmentInput = Readonly<{
  readonly browserEngine: string;
  readonly devicePixelRatio: number;
  readonly logicalProcessorCount: number;
  readonly mode: string;
  readonly userAgent: string;
  readonly viewport: Readonly<{ readonly height: number; readonly width: number }>;
}>;

export type AstryxTableBenchmarkEnvironment = AstryxTableBenchmarkEnvironmentInput &
  Readonly<{ readonly profile: typeof ASTRYX_TABLE_CAPABLE_HARDWARE_PROFILE.id }>;

const admittedBenchmarkEnvironments = new WeakSet<object>();
let installedBenchmarkEnvironment: AstryxTableBenchmarkEnvironment | undefined;

function sameAstryxTableBenchmarkEnvironment(
  left: AstryxTableBenchmarkEnvironment,
  right: AstryxTableBenchmarkEnvironment,
): boolean {
  return (
    left.browserEngine === right.browserEngine &&
    left.devicePixelRatio === right.devicePixelRatio &&
    left.logicalProcessorCount === right.logicalProcessorCount &&
    left.mode === right.mode &&
    left.profile === right.profile &&
    left.userAgent === right.userAgent &&
    left.viewport.height === right.viewport.height &&
    left.viewport.width === right.viewport.width
  );
}

export function validateAstryxTableBenchmarkEnvironment(
  environment: AstryxTableBenchmarkEnvironmentInput,
): AstryxTableBenchmarkEnvironment {
  const profile = ASTRYX_TABLE_CAPABLE_HARDWARE_PROFILE;
  if (environment.browserEngine !== profile.requiredBrowserEngine) {
    throw new Error(`${profile.id} requires browser engine ${profile.requiredBrowserEngine}.`);
  }
  if (environment.mode !== profile.requiredMode) {
    throw new Error(`${profile.id} requires mode ${profile.requiredMode}.`);
  }
  if (
    environment.viewport.width !== profile.requiredViewport.width ||
    environment.viewport.height !== profile.requiredViewport.height
  ) {
    throw new Error(
      `${profile.id} requires viewport ${String(profile.requiredViewport.width)}x${String(profile.requiredViewport.height)}.`,
    );
  }
  if (environment.devicePixelRatio !== profile.requiredDevicePixelRatio) {
    throw new Error(
      `${profile.id} requires devicePixelRatio ${String(profile.requiredDevicePixelRatio)}.`,
    );
  }
  if (
    !Number.isSafeInteger(environment.logicalProcessorCount) ||
    environment.logicalProcessorCount < profile.minimumLogicalProcessorCount
  ) {
    throw new Error(
      `${profile.id} requires at least ${String(profile.minimumLogicalProcessorCount)} logical processors.`,
    );
  }
  if (
    environment.userAgent.length === 0 ||
    environment.userAgent.trim() !== environment.userAgent
  ) {
    throw new Error(`${profile.id} requires a normalized non-empty user agent.`);
  }
  if (!/(?:Headless)?Chrome\//u.test(environment.userAgent)) {
    throw new Error(`${profile.id} requires a Chromium user agent.`);
  }

  const validated = Object.freeze({
    browserEngine: environment.browserEngine,
    devicePixelRatio: environment.devicePixelRatio,
    logicalProcessorCount: environment.logicalProcessorCount,
    mode: environment.mode,
    profile: profile.id,
    userAgent: environment.userAgent,
    viewport: Object.freeze({
      height: environment.viewport.height,
      width: environment.viewport.width,
    }),
  });
  admittedBenchmarkEnvironments.add(validated);
  return validated;
}

export function installAstryxTableBenchmarkEnvironment(
  environment: AstryxTableBenchmarkEnvironmentInput,
): AstryxTableBenchmarkEnvironment {
  const validated = validateAstryxTableBenchmarkEnvironment(environment);
  if (installedBenchmarkEnvironment === undefined) {
    installedBenchmarkEnvironment = validated;
    return validated;
  }
  if (!sameAstryxTableBenchmarkEnvironment(installedBenchmarkEnvironment, validated)) {
    throw new Error(
      "AstryxTable benchmark environment is already installed with different evidence.",
    );
  }
  return installedBenchmarkEnvironment;
}

export function getAstryxTableBenchmarkEnvironment(): AstryxTableBenchmarkEnvironment {
  if (installedBenchmarkEnvironment === undefined) {
    throw new Error("AstryxTable benchmark environment has not been installed.");
  }
  return installedBenchmarkEnvironment;
}

export function requireValidatedAstryxTableBenchmarkEnvironment(
  environment: unknown,
): AstryxTableBenchmarkEnvironment {
  const installed = installedBenchmarkEnvironment;
  if (
    installed === undefined ||
    environment !== installed ||
    typeof environment !== "object" ||
    environment === null ||
    !admittedBenchmarkEnvironments.has(environment)
  ) {
    throw new Error("AstryxTable benchmark evidence requires the installed Browser environment.");
  }
  return installed;
}
