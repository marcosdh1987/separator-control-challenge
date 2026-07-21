import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { GameDashboard } from "./game-dashboard";
import type {
  SimulationSample,
  WorkerEvent,
  WorkerRequest,
} from "@/lib/simulation/types";

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
    label: "Normal operating envelope",
    trip: null,
  },
  disturbance: "Steady oil/water feed",
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
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: FakeWorker });
  });

  it("starts the default slug challenge and locks the controller", async () => {
    const user = userEvent.setup();
    render(<GameDashboard />);

    expect(screen.getByRole("heading", { name: "Separator Control Challenge" })).toBeVisible();
    expect(screen.getByRole("radio", { name: /water-rich liquid slug/i })).toBeChecked();
    expect(screen.getByText(/educational simulator/i)).toBeVisible();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start attempt/i })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: /start attempt/i }));

    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: "Total level proportional gain" })).toBeDisabled();
      expect(screen.getByRole("button", { name: /pause attempt/i })).toBeVisible();
    });
  });

  it("exposes both loops, both valves, safety feedback, transport, and four trends", async () => {
    render(<GameDashboard />);
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
    render(<GameDashboard />);
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

    sendSafety({ severity: "alarm", source: "total", label: "Total level high alarm", trip: null });
    await waitFor(() => expect(announcer).toHaveTextContent("Safety changed to alarm: Total level high alarm"));

    sendSafety({ severity: "alarm", source: "interface", label: "Interface high alarm", trip: null });
    expect(announcer).toHaveTextContent("Safety changed to alarm: Total level high alarm");
    expect(announcer).not.toHaveTextContent("Interface high alarm");

    sendSafety({ severity: "trip", source: "interface", label: "Interface high-high trip", trip: "INTERFACE_HH" });
    await waitFor(() => expect(announcer).toHaveTextContent("Safety changed to trip: Interface high-high trip"));
    expect(document.querySelectorAll("[aria-live]:not([aria-live='off'])")).toHaveLength(1);
  });

  it("posts both PID loops while independently editing total gain", async () => {
    const user = userEvent.setup();
    render(<GameDashboard />);
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
    render(<GameDashboard />);
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
    render(<GameDashboard />);
    const retry = await screen.findByRole("button", { name: "Retry simulation worker" });
    expect(screen.getByRole("alert")).toHaveTextContent(/worker unavailable.*could not be created/i);
    await user.click(retry);
    await waitFor(() => expect(screen.getByRole("button", { name: "Start attempt" })).toBeEnabled());
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("does not start before the simulation worker is ready", () => {
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: DelayedWorker });
    render(<GameDashboard />);

    expect(screen.getByRole("button", { name: /start attempt/i })).toBeDisabled();
  });
});
