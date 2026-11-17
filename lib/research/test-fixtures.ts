import { SIGNAL_SPECS, type ReplaySignalJson, type ResearchReplayV1, type SignalKey } from "@/lib/research/contract";

/**
 * A small, valid replay document for unit tests. Values are synthetic and only
 * exercise the decoder, timeline and playback; they are never shown to users.
 */
export function makeReplayDoc(options: { count?: number; startS?: number; holdStartS?: number } = {}): ResearchReplayV1 {
  const count = options.count ?? 11;
  const startS = options.startS ?? 1;
  const holdStart = options.holdStartS ?? startS + 4;
  const endS = startS + count - 1;
  const signal = (key: SignalKey, values: (number | null)[], extra: Partial<ReplaySignalJson> = {}): ReplaySignalJson => ({
    key,
    originalName: SIGNAL_SPECS[key].column,
    unit: "%",
    kind: "truth",
    source: "test",
    description: "test signal",
    role: SIGNAL_SPECS[key].role,
    interpolation: SIGNAL_SPECS[key].role === "continuous" ? "linear" : "hold",
    group: SIGNAL_SPECS[key].group,
    loop: null,
    numberFormat: "f64",
    nullCount: values.filter((v) => v === null).length,
    digest: "sha256:0",
    encoding: "dense",
    values,
    ...extra,
  });
  return {
    schema: "scc.research-replay",
    schemaVersion: 1,
    contractVersion: "1.0.0",
    replayId: "test-dataset/test-run",
    generatedAt: "2026-01-01T00:00:00+00:00",
    exporter: { name: "test", version: "1", policyId: "test" },
    source: {
      simulator: "eng_dacs",
      simulatorDescription: "test",
      repository: "x/y",
      repositoryAccess: "private",
      datasetId: "test-dataset",
      campaignId: "test-campaign",
      campaignDescription: "",
      datasetContractVersion: "envelope-1.0",
      datasetGeneratedAt: null,
      gitSha: "abc",
      gitBranch: null,
      gitDirtyFileCount: 0,
      configSha256Raw: null,
      configSha256Resolved: null,
      sourceCodeDigest: null,
      documentation: [],
    },
    evidence: {
      stage: "exploratory",
      stageDeclared: true,
      calibration: "synthetic_uncalibrated",
      calibrationIds: [],
      scenarioEvidence: "exploratory_synthetic",
      modelUncertainties: [],
      campaignSeeds: [7100],
      frozenCriteriaSha256: null,
    },
    run: {
      runId: "test-run",
      scenarioId: "center",
      variantId: "nominal",
      seed: 7100,
      block: null,
      variant: { variantId: "nominal", policy: null, params: {}, basis: null, provenance: null, references: [], modifiers: [] },
      controller: { policy: null, params: null, valid: true, records: [] },
      setpointSteps: [],
      factors: {},
      plantConstants: {},
      outcome: null,
      dominantConstraint: null,
      closestConstraint: null,
      closestUtilization: null,
      tripped: false,
    },
    instrumentation: {
      gas: { controller: "PIC-101", valve: "PCV-101", measurement: "PT-101" },
      oil: { controller: "LIC-102", valve: "LCV-102", measurement: "LT-102" },
      water: { controller: "LIC-103", valve: "LCV-103", measurement: "LT-103" },
    },
    codeTables: {},
    time: { unit: "s", origin: "boot", sampleIntervalS: 1, intervalSource: "test", startS, endS, count },
    phases: [
      { name: "steady", startS, endS: holdStart - 1 },
      { name: "hold", startS: holdStart, endS },
    ],
    events: [
      { id: "e000", tS: startS + 2, kind: "command", severity: "info", origin: "recorded", source: "test", detail: {} },
      { id: "e001", tS: endS - 1, kind: "band_exit", severity: "critical", origin: "evaluation", source: "test", detail: {}, verified: true },
    ],
    signals: [
      signal("level.total.truth", Array.from({ length: count }, (_, i) => 50 + i)),
      signal("valve.oil.command", Array.from({ length: count }, (_, i) => (i === 3 ? null : 10 * i))),
      signal("loop.oil.sp", [], { encoding: "changes", values: undefined, changes: [[0, 50], [Math.floor(count / 2), 55]] }),
    ],
    missingSignals: [],
    metrics: {},
    metricsSource: "test",
    constraints: [],
    criteria: { thresholds: { level_band_pct: 2 }, controlCriteria: null, reportKind: null },
    privacy: { policyId: "test", policySha256: "0", withheld: [] },
    disclaimer: "test",
  };
}
