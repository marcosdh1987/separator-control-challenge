import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EnvelopeExplorer } from "./envelope-explorer";
import { ExperimentView } from "./experiment-view";
import { ResearchLab } from "./research-lab";
import { renderWithLocale } from "@/lib/i18n/test-utils";
import { clearResearchCache } from "@/lib/research/loaders";

/**
 * The Research Lab pages against the committed data. fetch serves the files
 * from public/research/v1 (decompressed here: the browser gzip path is tested
 * in lib/research/decode.test.ts).
 */

const ROOT = resolve(process.cwd(), "public/research/v1");
const metricsTable = () => within(screen.getByRole("region", { name: "Metrics" })).getByRole("table");

function serve(url: string): Response {
  const relative = url.replace(/^.*\/research\/v1\//, "");
  const bytes = readFileSync(resolve(ROOT, relative));
  const body = relative.endsWith(".gz") ? gunzipSync(bytes) : bytes;
  return new Response(new Uint8Array(body), { status: 200 });
}

beforeEach(() => {
  clearResearchCache();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => serve(String(url))));
  // jsdom has no WebGL: the experiment falls back to the technical view.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Research Lab catalogue", () => {
  it("lists every entry with an availability derived from the published index", async () => {
    renderWithLocale(<ResearchLab />);
    expect(screen.getByRole("heading", { level: 1, name: /replay real research runs/i })).toBeVisible();
    expect(screen.getByText(/not a validated industrial control system/i)).toBeVisible();
    await waitFor(() => expect(screen.getAllByRole("link", { name: /open experiment/i })).toHaveLength(3));
    expect(screen.getByRole("link", { name: /open the explorer/i })).toHaveAttribute("href", "/research/envelope");
    const pending = screen.getByText("Time-evolving wells (campaign D)").closest("li")!;
    expect(within(pending).getByText("Pending")).toBeVisible();
    const closed = screen.getByText("Field-calibrated well cases").closest("li")!;
    expect(within(closed).getByText("Not publishable")).toBeVisible();
  });

  it("reads in Spanish when the locale is Spanish", async () => {
    renderWithLocale(<ResearchLab />, { locale: "es" });
    expect(screen.getByRole("heading", { level: 1, name: /reproduce corridas reales/i })).toBeVisible();
    await waitFor(() => expect(screen.getAllByRole("link", { name: /abrir experimento/i })).toHaveLength(3));
  });
});

describe("experiment player", () => {
  it("aligns the lag runs on the hold, states the shift and reproduces every claim", async () => {
    renderWithLocale(<ExperimentView experimentId="c2-lcv102-actuator-lag" />);
    await screen.findByText(/paired runs: scenario high_rate-000, seed 7100/i, {}, { timeout: 5000 });
    expect(screen.getByTestId("research-shifts")).toHaveTextContent("shift -396 s");
    const claims = await screen.findAllByText("agrees");
    expect(claims).toHaveLength(4);
    expect(screen.queryByText("differs")).toBeNull();
    const table = metricsTable();
    expect(within(table).getByText("loses band")).toBeVisible();
    expect(within(table).getByText("12,415 s after hold start")).toBeVisible();
    expect(within(table).getByText("sustains")).toBeVisible();
  });

  it("plays, pauses, changes speed and seeks without touching the data", async () => {
    renderWithLocale(<ExperimentView experimentId="c2-lcv102-stiction" />);
    const play = await screen.findByRole("button", { name: "Play" }, { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "×50" }));
    expect(screen.getByRole("button", { name: "×50" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(play);
    expect(screen.getByRole("button", { name: "Pause" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    const slider = screen.getByRole("slider", { name: "Simulated time" });
    fireEvent.change(slider, { target: { value: "600" } });
    expect(screen.getByTestId("research-time")).toHaveTextContent("10:00");
    expect(screen.getByTestId("research-frame")).toHaveTextContent("Recorded tick");
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(screen.getByRole("button", { name: "Play" })).toBeVisible();
  });

  it("falls back to the technical view without WebGL and names the eng_dacs instruments", async () => {
    renderWithLocale(<ExperimentView experimentId="c2-lcv102-stiction" />);
    const diagram = await screen.findByRole("img", { name: /piping and instrumentation view/i }, { timeout: 5000 });
    expect(within(diagram).getAllByText("LCV-102").length).toBeGreaterThan(0);
    expect(within(diagram).getByText("PIC-101")).toBeInTheDocument();
    expect(await screen.findByText(/3D view is unavailable/i)).toBeVisible();
  });

  it("shows the pi_1p5 exception as saturated, not as a failure to settle", async () => {
    renderWithLocale(<ExperimentView experimentId="c2-lic103-simc" />);
    fireEvent.click(await screen.findByRole("button", { name: /pi_1p5/i }));
    await waitFor(() => expect(within(metricsTable()).getByText("saturated")).toBeVisible(), { timeout: 10000 });
    expect(within(metricsTable()).getByText("fast")).toBeVisible();
    expect(await screen.findAllByText("agrees")).toHaveLength(9);
  }, 20000);

  it("keeps the learning content tied to the course without changing it", async () => {
    renderWithLocale(<ExperimentView experimentId="c2-lcv102-stiction" />);
    expect(screen.getByRole("heading", { name: /learn from this experiment/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /integral action, and how it gets stuck/i })).toHaveAttribute("href", "/training/integral-action-and-windup");
    expect(screen.getAllByText(/private repository/i).length).toBeGreaterThan(0);
    await act(async () => { await Promise.resolve(); });
  });
});

describe("operating envelope explorer", () => {
  it("plots every evaluated scenario and opens a selected one", async () => {
    renderWithLocale(<EnvelopeExplorer />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /__nominal__s7100:/ }).length).toBe(40), { timeout: 5000 });
    expect(screen.getByText(/no frontier is drawn/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /^oat-bean_64th-2__nominal__s7100:/ }));
    expect(screen.getByText("Selected run")).toBeVisible();
    expect(screen.getAllByText("P.flowline_erosion").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Open the replay" })).toHaveAttribute(
      "href",
      "/research/replay/nominal-pilot-20261113T234459Z/oat-bean_64th-2__nominal__s7100",
    );
    fireEvent.click(screen.getByRole("button", { name: /^lhs-b2-001__nominal__s7100:/ }));
    expect(screen.getByText(/replay not published/i)).toBeVisible();
    expect(await screen.findAllByText("agrees")).toHaveLength(5);
  });

  it("does not plot runs without a flowing operating point on operating-point axes", async () => {
    renderWithLocale(<EnvelopeExplorer />);
    const xAxis = await screen.findByRole("combobox", { name: /horizontal axis/i }, { timeout: 5000 });
    fireEvent.change(xAxis, { target: { value: "op_inlet_liquid_truth_m3_h" } });
    expect(screen.getByText(/4 runs have no value on these axes/i)).toBeVisible();
    expect(screen.getAllByRole("button", { name: /__nominal__s7100:/ })).toHaveLength(36);
  });
});
