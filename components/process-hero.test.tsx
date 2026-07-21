import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const sceneMock = vi.hoisted(() => ({ mode: "success" as "success" | "pending" | "failure" }));

vi.mock("./scene/separator-scene", () => ({
  SeparatorScene: ({
    onReady,
    onSceneError,
    resetToken,
    mode,
  }: {
    onReady?: () => void;
    onSceneError?: (error: Error) => void;
    resetToken: number;
    mode?: "dashboard" | "presentation";
  }) => {
    useEffect(() => {
      if (sceneMock.mode === "pending") return;
      const frame = requestAnimationFrame(() => {
        if (sceneMock.mode === "failure") onSceneError?.(new Error("compile failed"));
        else onReady?.();
      });
      return () => cancelAnimationFrame(frame);
    }, [onReady, onSceneError]);
    return <div data-mode={mode} data-reset-token={resetToken} data-testid="three-separator-scene"><canvas data-testid="three-canvas" /></div>;
  },
}));

import { ProcessHero } from "./process-hero";
import { createEquilibriumSample } from "@/hooks/use-simulation";

describe("process hero", () => {
  afterEach(() => {
    sceneMock.mode = "success";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not inspect canvas at module load and renders the full fallback without WebGL", async () => {
    vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContext {});
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(getContext).not.toHaveBeenCalled();
    render(<ProcessHero sample={createEquilibriumSample()} status="idle" />);
    await waitFor(() => expect(getContext).toHaveBeenCalled());
    expect(screen.getByRole("region", { name: /separator process cutaway/i })).toBeVisible();
    expect(screen.queryByTestId("three-separator-scene")).not.toBeInTheDocument();
  });

  it("keeps the fallback until a rendered scene frame and then exposes reset view", async () => {
    vi.stubGlobal("WebGL2RenderingContext", class WebGL2RenderingContext {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId) => contextId === "webgl2" ? ({} as WebGL2RenderingContext) : null);
    render(<ProcessHero sample={createEquilibriumSample()} status="running" />);
    expect(screen.getByRole("region", { name: /separator process cutaway/i })).toBeVisible();
    expect(await screen.findByTestId("three-separator-scene")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Reset 3D view" })).toBeVisible();
    expect(screen.queryByRole("region", { name: /separator process cutaway/i })).not.toBeInTheDocument();
  });

  it("propagates the low-cost presentation profile and removes the interactive reset", async () => {
    vi.stubGlobal("WebGL2RenderingContext", class WebGL2RenderingContext {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as WebGL2RenderingContext);
    render(<ProcessHero mode="presentation" sample={createEquilibriumSample()} status="idle" />);

    expect((await screen.findByTestId("three-separator-scene"))).toHaveAttribute("data-mode", "presentation");
    expect(screen.queryByRole("button", { name: "Reset 3D view" })).not.toBeInTheDocument();
  });

  it("returns to the SVG fallback after a ready presentation canvas loses its WebGL context", async () => {
    vi.stubGlobal("WebGL2RenderingContext", class WebGL2RenderingContext {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as WebGL2RenderingContext);
    render(<ProcessHero mode="presentation" sample={createEquilibriumSample()} status="idle" />);

    await waitFor(() => expect(screen.queryByRole("region", { name: /separator process cutaway/i })).not.toBeInTheDocument());
    const canvas = screen.getByTestId("three-canvas");
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));

    await waitFor(() => expect(screen.queryByTestId("three-separator-scene")).not.toBeInTheDocument());
    expect(screen.getByRole("region", { name: /separator process cutaway/i })).toBeVisible();
  });

  it("returns the dashboard to its SVG fallback after a ready canvas loses its WebGL context", async () => {
    vi.stubGlobal("WebGL2RenderingContext", class WebGL2RenderingContext {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as WebGL2RenderingContext);
    render(<ProcessHero sample={createEquilibriumSample()} status="idle" />);

    expect(await screen.findByRole("button", { name: "Reset 3D view" })).toBeVisible();
    screen.getByTestId("three-canvas").dispatchEvent(new Event("webglcontextlost", { cancelable: true }));

    await waitFor(() => expect(screen.queryByTestId("three-separator-scene")).not.toBeInTheDocument());
    expect(screen.getByRole("region", { name: /separator process cutaway/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reset 3D view" })).not.toBeInTheDocument();
  });

  it("marks the presentation wrapper so its canvas can preserve vertical touch scrolling", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<ProcessHero mode="presentation" sample={createEquilibriumSample()} status="idle" />);

    expect(document.querySelector(".process-hero-presentation")).toHaveAttribute("data-presentation-mode", "true");
  });

  it("keeps the fallback and hides reset while scene compilation is pending", async () => {
    sceneMock.mode = "pending";
    vi.stubGlobal("WebGL2RenderingContext", class WebGL2RenderingContext {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as WebGL2RenderingContext);
    render(<ProcessHero sample={createEquilibriumSample()} status="running" />);
    expect(await screen.findByTestId("three-separator-scene")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /separator process cutaway/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reset 3D view" })).not.toBeInTheDocument();
  });

  it("keeps the fallback and unmounts a scene that reports compilation failure", async () => {
    sceneMock.mode = "failure";
    vi.stubGlobal("WebGL2RenderingContext", class WebGL2RenderingContext {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as WebGL2RenderingContext);
    render(<ProcessHero sample={createEquilibriumSample()} status="running" />);
    await waitFor(() => expect(screen.queryByTestId("three-separator-scene")).not.toBeInTheDocument());
    expect(screen.getByRole("region", { name: /separator process cutaway/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reset 3D view" })).not.toBeInTheDocument();
  });

  it("increments the camera reset token without changing process data", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("WebGL2RenderingContext", class WebGL2RenderingContext {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as WebGL2RenderingContext);
    render(<ProcessHero sample={createEquilibriumSample()} status="running" />);
    const scene = await screen.findByTestId("three-separator-scene");
    expect(scene).toHaveAttribute("data-reset-token", "0");
    await user.click(await screen.findByRole("button", { name: "Reset 3D view" }));
    expect(scene).toHaveAttribute("data-reset-token", "1");
  });

  it("releases the temporary WebGL probe context when supported", async () => {
    vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContext {});
    const loseContext = vi.fn();
    const getExtension = vi.fn(() => ({ loseContext }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ getExtension } as unknown as WebGLRenderingContext);
    render(<ProcessHero sample={createEquilibriumSample()} status="idle" />);
    await waitFor(() => expect(loseContext).toHaveBeenCalledOnce());
    expect(getExtension).toHaveBeenCalledWith("WEBGL_lose_context");
  });

  it("does not fail when the WebGL release extension is absent or throws", async () => {
    vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContext {});
    const getExtension = vi.fn(() => { throw new Error("extension unavailable"); });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ getExtension } as unknown as WebGLRenderingContext);
    render(<ProcessHero sample={createEquilibriumSample()} status="idle" />);
    expect(await screen.findByTestId("three-separator-scene")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Reset 3D view" })).toBeVisible();
  });

  it("keeps a non-live engineering summary outside the visual boundary", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const sample = createEquilibriumSample();
    sample.safety = { severity: "alarm", source: "interface", label: "Interface high alarm", trip: null };
    render(<ProcessHero sample={sample} status="running" />);
    const summary = screen.getByText(/SEP-101 horizontal separator with gas, oil, and water/i);
    expect(summary).toHaveAttribute("aria-live", "off");
    expect(summary).toHaveTextContent("Interface high alarm");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(document.querySelectorAll("[aria-live]:not([aria-live='off'])")).toHaveLength(0);
  });
});
