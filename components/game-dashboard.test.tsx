import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { GameDashboard } from "./game-dashboard";
import { renderWithLocale } from "@/lib/i18n/test-utils";
import { TOUR_STEPS } from "./onboarding/guided-tour";
import type {
  RunResult,
  SimulationSample,
  WorkerEvent,
  WorkerRequest,
} from "@/lib/simulation/types";

const finishedResult = {
  score: { safety: 35, tracking: 25, stability: 15, recovery: 15, valveEfficiency: 10, modifiers: [], total: 100, rank: "master", feedback: { kind: "balanced" } },
  metrics: {
    trip: null, settled: true, recoveryTimeS: 1, minimumOilLayerPct: 20, alarmTimeS: 0,
    loops: { total: { mae: 1, stabilityStdDev: 1, maximumPct: 51, minimumPct: 49, targetBandTimeOutsideS: 0, oscillationCrossings: 0, oscillationPeakToPeakPct: 0, recoveryTimeS: 1, settled: true, alarmTimeS: 0 }, interface: { mae: 1, stabilityStdDev: 1, maximumPct: 21, minimumPct: 19, targetBandTimeOutsideS: 0, oscillationCrossings: 0, oscillationPeakToPeakPct: 0, recoveryTimeS: 1, settled: true, alarmTimeS: 0 } },
    actuators: { oil: { travelPct: 1, saturationTimeS: 0, integralLimitTimeS: 0 }, water: { travelPct: 1, saturationTimeS: 0, integralLimitTimeS: 0 } },
    phaseTotals: { oilInletM3: 1, waterInletM3: 1, oilOutletM3: 1, waterOutletM3: 1, finalOilVolumeM3: 1, finalWaterVolumeM3: 1 },
  },
} satisfies RunResult;

const initialSample = {
  timeS: 0,
  total: {
    processValuePct: 50,
    measuredValuePct: 50,
    setpointPct: 50,
    errorPct: 0,
    valveCommandPct: 50,
    valvePositionPct: 50,
    proportionalTerm: 0,
    integralTerm: 0,
    derivativeTerm: 0,
  },
  interface: {
    processValuePct: 20,
    measuredValuePct: 20,
    setpointPct: 20,
    errorPct: 0,
    valveCommandPct: 50,
    valvePositionPct: 50,
    proportionalTerm: 0,
    integralTerm: 0,
    derivativeTerm: 0,
  },
  oilVolumeM3: 1.2133815748487394,
  waterVolumeM3: 0.48307883544174135,
  oilLayerPct: 30,
  flows: {
    totalInletM3H: 50,
    waterCutFraction: 0.3,
    oilInletM3H: 35,
    waterInletM3H: 15,
    oilOutletM3H: 35,
    waterOutletM3H: 15,
  },
  safety: {
    severity: "safe",
    source: null,
    condition: "normal",
    trip: null,
  },
  disturbance: "steady",
} satisfies SimulationSample;

class FakeWorker {
  static instances: FakeWorker[] = [];

  messages: WorkerRequest[] = [];
  onmessage: ((event: MessageEvent<WorkerEvent>) => void) | null = null;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(request: WorkerRequest) {
    this.messages.push(request);
    if (request.type === "initialize") {
      queueMicrotask(() => {
        this.onmessage?.({ data: { type: "ready", runId: request.runId, sample: initialSample } } as MessageEvent<WorkerEvent>);
        this.onmessage?.({ data: { type: "status", runId: request.runId, status: "idle" } } as MessageEvent<WorkerEvent>);
      });
    }
    if (request.type === "start") {
      queueMicrotask(() => {
        this.onmessage?.({ data: { type: "status", runId: request.runId, status: "running" } } as MessageEvent<WorkerEvent>);
      });
    }
  }

  terminate() {}
}

class DelayedWorker extends FakeWorker {
  postMessage() {}
}

class DelayedResetWorker extends FakeWorker {
  initialized = false;

  postMessage(request: WorkerRequest) {
    if (request.type === "initialize" && !this.initialized) {
      this.initialized = true;
      super.postMessage(request);
      return;
    }
    this.messages.push(request);
  }
}

class RecoverableDashboardWorker {
  static attempts = 0;
  constructor() {
    RecoverableDashboardWorker.attempts += 1;
    if (RecoverableDashboardWorker.attempts === 1) throw new Error("construction failed");
    return new FakeWorker();
  }
}

describe("game dashboard", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    RecoverableDashboardWorker.attempts = 0;
    window.localStorage.clear();
    window.localStorage.setItem("separator-control-onboarding-v1", JSON.stringify({ quickStartDismissed: true }));
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: FakeWorker });
  });

  it("starts on the first scored scenario and locks the controller", async () => {
    const user = userEvent.setup();
    renderWithLocale(<GameDashboard />);

    expect(screen.getByRole("heading", { name: "Separator Control Challenge" })).toBeVisible();
    // A first-time visitor should land on the scenario the guided tour recommends,
    // not on the hardest one in the catalogue.
    expect(screen.getByRole("radio", { name: /oil\/water feed step/i })).toBeChecked();
    expect(screen.getByText(/educational simulator/i)).toBeVisible();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start attempt/i })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: /start attempt/i }));

    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: "Total level proportional gain" })).toBeDisabled();
      expect(screen.getByRole("button", { name: /pause attempt/i })).toBeVisible();
      expect(screen.getByText("Final deterministic score calculated when the attempt ends")).toBeVisible();
    });
  });

  it("exposes both loops, both valves, safety feedback, transport, and four trends", async () => {
    renderWithLocale(<GameDashboard />);
    await waitFor(() => expect(screen.getByRole("button", { name: /start attempt/i })).toBeEnabled());
    expect(screen.getByText("Total level", { selector: ".metrics-grid span" })).toBeVisible();
    expect(screen.getByText("Oil/water interface", { selector: ".metrics-grid span" })).toBeVisible();
    expect(screen.getByText("Oil valve LV-101", { selector: ".metrics-grid span" })).toBeVisible();
    expect(screen.getByText("Water valve WV-101", { selector: ".metrics-grid span" })).toBeVisible();
    expect(screen.getByText("Normal operating envelope", { selector: ".metrics-grid strong" })).toBeVisible();
    expect(screen.getByRole("button", { name: /start attempt/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /reset attempt/i })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Total liquid level" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Oil/water interface" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Phase flows" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Valve response" })).toBeVisible();
  });

  it("announces each safety severity transition once and ignores same-severity detail changes", async () => {
    renderWithLocale(<GameDashboard />);
    await waitFor(() => expect(screen.getByRole("button", { name: /start attempt/i })).toBeEnabled());
    const worker = FakeWorker.instances[0];
    const initialize = worker.messages.find(
      (message): message is Extract<WorkerRequest, { type: "initialize" }> => message.type === "initialize",
    );
    expect(initialize).toBeDefined();
    const liveRegions = document.querySelectorAll("[aria-live]:not([aria-live='off'])");
    expect(liveRegions).toHaveLength(1);
    const announcer = liveRegions[0];

    const sendSafety = (safety: SimulationSample["safety"]) => act(() => {
      worker.onmessage?.({
        data: {
          type: "samples",
          runId: initialize!.runId,
          samples: [{ ...initialSample, safety }],
        },
      } as MessageEvent<WorkerEvent>);
    });

    sendSafety({ severity: "alarm", source: "total", condition: "total-high", trip: null });
    await waitFor(() => expect(announcer).toHaveTextContent("Safety changed to alarm: Total level high alarm"));

    sendSafety({ severity: "alarm", source: "interface", condition: "interface-high", trip: null });
    expect(announcer).toHaveTextContent("Safety changed to alarm: Total level high alarm");
    expect(announcer).not.toHaveTextContent("Interface high alarm");

    sendSafety({ severity: "trip", source: "interface", condition: "interface-high-high", trip: "INTERFACE_HH" });
    await waitFor(() => expect(announcer).toHaveTextContent("Safety changed to trip: Interface high-high trip"));
    expect(document.querySelectorAll("[aria-live]:not([aria-live='off'])")).toHaveLength(1);
  });

  it("posts both PID loops while independently editing total gain", async () => {
    const user = userEvent.setup();
    renderWithLocale(<GameDashboard />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start attempt/i })).toBeEnabled();
    });

    const kp = screen.getByRole("spinbutton", { name: "Total level proportional gain" });
    await user.clear(kp);
    await user.type(kp, "6");
    await waitFor(() => {
      const messages = FakeWorker.instances[0].messages;
      const request = messages.filter(
        (message): message is Extract<WorkerRequest, { type: "initialize" }> =>
          message.type === "initialize",
      ).at(-1);
      expect(request?.pid).toMatchObject({
        total: { kp: 6 },
        interface: { kp: 4, ki: 0.08, kd: 8 },
      });
    });

    await user.click(screen.getByRole("button", { name: /start attempt/i }));
    await waitFor(() => {
      const messages = FakeWorker.instances[0].messages;
      expect(messages.slice(-3).map((message) => message.type)).toEqual([
        "initialize",
        "set-speed",
        "start",
      ]);
    });
  });

  it("posts an interface gain edit while preserving total tuning", async () => {
    const user = userEvent.setup();
    renderWithLocale(<GameDashboard />);
    await waitFor(() => expect(screen.getByRole("button", { name: /start attempt/i })).toBeEnabled());
    const kp = screen.getByRole("spinbutton", { name: "Interface proportional gain" });
    await user.clear(kp);
    await user.type(kp, "5");
    await waitFor(() => {
      const request = FakeWorker.instances[0].messages.filter(
        (message): message is Extract<WorkerRequest, { type: "initialize" }> => message.type === "initialize",
      ).at(-1);
      expect(request?.pid).toMatchObject({
        total: { kp: 4, ki: 0.08, kd: 8 },
        interface: { kp: 5 },
      });
    });
  });

  it("offers actionable recovery after Worker construction failure", async () => {
    const user = userEvent.setup();
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: RecoverableDashboardWorker });
    renderWithLocale(<GameDashboard />);
    const retry = await screen.findByRole("button", { name: "Retry simulation worker" });
    expect(screen.getByRole("alert")).toHaveTextContent(/worker unavailable.*could not be created/i);
    await user.click(retry);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start attempt" })).toBeEnabled());
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("does not start before the simulation worker is ready", () => {
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: DelayedWorker });
    renderWithLocale(<GameDashboard />);

    expect(screen.getByRole("button", { name: /start attempt/i })).toBeDisabled();
  });

  it("states score availability truthfully and exposes stable tour anchors", async () => {
    renderWithLocale(<GameDashboard />);
    await waitFor(() => expect(screen.getByRole("button", { name: /start attempt/i })).toBeEnabled());

    expect(screen.getByText("Not started")).toBeVisible();
    expect(screen.queryByText("Current score")).not.toBeInTheDocument();
    for (const target of ["scenario-selector", "total-pid", "interface-pid", "start-attempt", "process-view", "live-trends", "score-safety"]) {
      expect(document.querySelector(`[data-tour="${target}"]`)).toBeTruthy();
    }
  });

  it("shows the quick start after hydration, keeps Skip session-only, and persists Don't show again", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    const first = renderWithLocale(<GameDashboard />);

    expect(await screen.findByRole("dialog", { name: "Your mission" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Skip and play" }));
    expect(screen.queryByRole("dialog", { name: "Your mission" })).not.toBeInTheDocument();

    first.unmount();
    const second = renderWithLocale(<GameDashboard />);
    expect(await screen.findByRole("dialog", { name: "Your mission" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Don't show again" }));
    expect(window.localStorage.getItem("separator-control-onboarding-v1")).toContain('"quickStartDismissed":true');

    second.unmount();
    renderWithLocale(<GameDashboard />);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Your mission" })).not.toBeInTheDocument());
  });

  it("launches the guided tour from quick start and persists its dismissal", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    const first = renderWithLocale(<GameDashboard />);

    await user.click(await screen.findByRole("button", { name: "Start guided tour" }));
    expect(screen.getByRole("dialog", { name: "Scenario selector" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Your mission" })).not.toBeInTheDocument();
    for (let index = 1; index < TOUR_STEPS.length; index += 1) {
      await user.click(screen.getByRole("button", { name: "Next" }));
    }
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(window.localStorage.getItem("separator-control-onboarding-v1")).toContain('"guidedTourDismissed":true');

    first.unmount();
    renderWithLocale(<GameDashboard />);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Scenario selector" })).not.toBeInTheDocument());
  });

  it("reports a closed final score after dismissing a completed result", async () => {
    const user = userEvent.setup();
    renderWithLocale(<GameDashboard />);
    await waitFor(() => expect(screen.getByRole("button", { name: /start attempt/i })).toBeEnabled());
    const initialize = FakeWorker.instances[0].messages.find((message): message is Extract<WorkerRequest, { type: "initialize" }> => message.type === "initialize")!;

    act(() => {
      FakeWorker.instances[0].onmessage?.({ data: { type: "status", runId: initialize.runId, status: "completed" } } as MessageEvent<WorkerEvent>);
      FakeWorker.instances[0].onmessage?.({ data: { type: "finished", runId: initialize.runId, status: "completed", result: finishedResult } } as unknown as MessageEvent<WorkerEvent>);
    });
    expect(screen.getByRole("dialog", { name: "Attempt results" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close results" }));

    expect(screen.getByText("Final score closed — reset to start another attempt")).toBeVisible();
    expect(screen.queryByText("Final deterministic score calculated when the attempt ends")).not.toBeInTheDocument();
  });

  it.each(["completed", "tripped"] as const)("reports a calculation in progress for %s attempts before the final result arrives", async (status) => {
    renderWithLocale(<GameDashboard />);
    await waitFor(() => expect(screen.getByRole("button", { name: /start attempt/i })).toBeEnabled());
    const initialize = FakeWorker.instances[0].messages.find((message): message is Extract<WorkerRequest, { type: "initialize" }> => message.type === "initialize")!;
    act(() => FakeWorker.instances[0].onmessage?.({ data: { type: "status", runId: initialize.runId, status } } as MessageEvent<WorkerEvent>));

    expect(screen.getByText("Calculating final deterministic score…")).toBeVisible();
  });

  it.each(["completed", "tripped"] as const)("prepares a fresh attempt rather than calculating a stale %s result after reset", async (status) => {
    const user = userEvent.setup();
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: DelayedResetWorker });
    renderWithLocale(<GameDashboard />);
    await waitFor(() => expect(screen.getByRole("button", { name: /start attempt/i })).toBeEnabled());
    const worker = FakeWorker.instances[0];
    const initialRun = worker.messages.find((message): message is Extract<WorkerRequest, { type: "initialize" }> => message.type === "initialize")!;

    act(() => worker.onmessage?.({ data: { type: "status", runId: initialRun.runId, status } } as MessageEvent<WorkerEvent>));
    await user.click(screen.getByRole("button", { name: "Reset attempt" }));
    const resetRun = worker.messages.at(-1) as Extract<WorkerRequest, { type: "initialize" }>;
    act(() => worker.onmessage?.({ data: { type: "status", runId: resetRun.runId, status } } as MessageEvent<WorkerEvent>));

    expect(screen.getByText("Preparing a fresh attempt…")).toBeVisible();
    expect(screen.queryByText("Calculating final deterministic score…")).not.toBeInTheDocument();

    act(() => worker.onmessage?.({ data: { type: "status", runId: resetRun.runId, status: "idle" } } as MessageEvent<WorkerEvent>));
    await waitFor(() => expect(screen.getByText("Not started")).toBeVisible());
  });

  it("prepares a fresh attempt rather than calculating a stale tripped result after retry", async () => {
    const user = userEvent.setup();
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: DelayedResetWorker });
    renderWithLocale(<GameDashboard />);
    await waitFor(() => expect(screen.getByRole("button", { name: /start attempt/i })).toBeEnabled());
    const worker = FakeWorker.instances[0];
    const initialRun = worker.messages.find((message): message is Extract<WorkerRequest, { type: "initialize" }> => message.type === "initialize")!;

    act(() => {
      worker.onmessage?.({ data: { type: "status", runId: initialRun.runId, status: "tripped" } } as MessageEvent<WorkerEvent>);
      worker.onmessage?.({ data: { type: "finished", runId: initialRun.runId, status: "tripped", result: finishedResult } } as unknown as MessageEvent<WorkerEvent>);
    });
    await user.click(screen.getByRole("button", { name: "Tune and retry" }));
    const retryRun = worker.messages.at(-1) as Extract<WorkerRequest, { type: "initialize" }>;
    act(() => worker.onmessage?.({ data: { type: "status", runId: retryRun.runId, status: "tripped" } } as MessageEvent<WorkerEvent>));

    expect(screen.getByText("Preparing a fresh attempt…")).toBeVisible();
    expect(screen.queryByText("Calculating final deterministic score…")).not.toBeInTheDocument();

    act(() => worker.onmessage?.({ data: { type: "status", runId: retryRun.runId, status: "idle" } } as MessageEvent<WorkerEvent>));
    await waitFor(() => expect(screen.getByText("Not started")).toBeVisible());
  });
});
