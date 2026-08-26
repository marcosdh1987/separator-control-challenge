import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./scene/separator-scene", () => ({
  SeparatorScene: ({ onReady }: { onReady?: () => void }) => {
    useEffect(() => {
      const frame = requestAnimationFrame(() => onReady?.());
      return () => cancelAnimationFrame(frame);
    }, [onReady]);
    return <div data-testid="three-separator-scene"><canvas data-testid="three-canvas" /></div>;
  },
}));

import { ProcessHero } from "./process-hero";
import { PROCESS_VIEW_STORAGE_KEY, resetProcessViewStore } from "@/components/mimic/process-view-store";
import { createEquilibriumSample } from "@/hooks/use-simulation";
import { renderWithLocale } from "@/lib/i18n/test-utils";

const withWebGL = () => {
  vi.stubGlobal("WebGL2RenderingContext", class WebGL2RenderingContext {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as WebGL2RenderingContext);
};

const withoutWebGL = () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
};

describe("process hero view switch", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetProcessViewStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    resetProcessViewStore();
  });

  it("starts on the 3D scene and offers the P&ID beside it", async () => {
    withWebGL();
    renderWithLocale(<ProcessHero sample={createEquilibriumSample()} status="running" />);

    const scene = screen.getByRole("button", { name: "Three-dimensional scene" });
    expect(scene).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Piping and instrumentation diagram" })).toHaveAttribute("aria-pressed", "false");
    expect(await screen.findByTestId("three-separator-scene")).toBeInTheDocument();
    expect(screen.queryByTestId("pid-mimic")).not.toBeInTheDocument();
  });

  it("swaps to the diagram, unmounts the scene and remembers the choice", async () => {
    const user = userEvent.setup();
    withWebGL();
    renderWithLocale(<ProcessHero sample={createEquilibriumSample()} status="running" />);
    expect(await screen.findByTestId("three-separator-scene")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Piping and instrumentation diagram" }));

    expect(screen.getByTestId("pid-mimic")).toBeInTheDocument();
    expect(screen.queryByTestId("three-separator-scene")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /separator process cutaway/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset 3D view" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(PROCESS_VIEW_STORAGE_KEY)).toBe("diagram");
  });

  it("restores a stored diagram preference without mounting the scene", async () => {
    withWebGL();
    window.localStorage.setItem(PROCESS_VIEW_STORAGE_KEY, "diagram");
    renderWithLocale(<ProcessHero sample={createEquilibriumSample()} status="running" />);

    expect(await screen.findByTestId("pid-mimic")).toBeInTheDocument();
    expect(screen.queryByTestId("three-separator-scene")).not.toBeInTheDocument();
  });

  it("ignores a corrupted preference and stays on the scene", async () => {
    withWebGL();
    window.localStorage.setItem(PROCESS_VIEW_STORAGE_KEY, "hologram");
    renderWithLocale(<ProcessHero sample={createEquilibriumSample()} status="running" />);

    expect(await screen.findByTestId("three-separator-scene")).toBeInTheDocument();
    expect(screen.queryByTestId("pid-mimic")).not.toBeInTheDocument();
  });

  it("returns to the scene and lets it earn its frame again", async () => {
    const user = userEvent.setup();
    withWebGL();
    window.localStorage.setItem(PROCESS_VIEW_STORAGE_KEY, "diagram");
    renderWithLocale(<ProcessHero sample={createEquilibriumSample()} status="running" />);
    expect(await screen.findByTestId("pid-mimic")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Three-dimensional scene" }));

    expect(await screen.findByTestId("three-separator-scene")).toBeInTheDocument();
    expect(screen.queryByTestId("pid-mimic")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(PROCESS_VIEW_STORAGE_KEY)).toBe("scene");
  });

  it("shows a device without WebGL the diagram rather than an empty 3D view", async () => {
    withoutWebGL();
    renderWithLocale(<ProcessHero sample={createEquilibriumSample()} status="idle" />);

    // Nothing to choose: the scene has no way to render here, so the diagram is
    // what the visitor gets without having to go and find it.
    expect(await screen.findByTestId("pid-mimic")).toBeInTheDocument();
    expect(screen.queryByText("3D view unavailable on this device")).not.toBeInTheDocument();
  });

  it("respects a deliberate choice of the 3D view even without WebGL", async () => {
    // Someone who picked the scene keeps it, and sees the semantic cutaway in its
    // place rather than being silently overridden.
    window.localStorage.setItem(PROCESS_VIEW_STORAGE_KEY, "scene");
    withoutWebGL();
    renderWithLocale(<ProcessHero sample={createEquilibriumSample()} status="idle" />);

    expect(await screen.findByText("3D view unavailable on this device")).toBeVisible();
    expect(screen.getByRole("region", { name: /separator process cutaway/i })).toBeVisible();
  });

  it("survives a storage that refuses to answer", async () => {
    withWebGL();
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    renderWithLocale(<ProcessHero sample={createEquilibriumSample()} status="running" />);

    await user.click(screen.getByRole("button", { name: "Piping and instrumentation diagram" }));
    expect(screen.getByTestId("pid-mimic")).toBeInTheDocument();
  });

  it("keeps the presentation hero on the scene, with no view switch to press", () => {
    withoutWebGL();
    renderWithLocale(<ProcessHero mode="presentation" sample={createEquilibriumSample()} status="idle" />);

    expect(screen.queryByRole("group", { name: "Process view" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("pid-mimic")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /separator process cutaway/i })).toBeVisible();
  });
});
