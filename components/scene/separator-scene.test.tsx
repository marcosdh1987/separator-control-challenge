import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const canvasProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children, ...props }: { children: React.ReactNode }) => {
    canvasProps.last = props;
    return <div data-testid="canvas">{children}</div>;
  },
  addAfterEffect: vi.fn(() => () => undefined),
  useFrame: vi.fn(),
  useThree: () => ({
    camera: { lookAt: vi.fn(), position: { set: vi.fn() } },
    gl: { compileAsync: vi.fn(), getContext: () => ({ isContextLost: () => false }), info: { render: { frame: 1 } } },
    invalidate: vi.fn(),
    scene: {},
  }),
}));
vi.mock("@react-three/drei", () => ({
  ContactShadows: () => <div data-testid="contact-shadows" />,
  Environment: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Html: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Lightformer: () => null,
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));
vi.mock("@react-three/postprocessing", () => ({
  Bloom: () => <div data-testid="bloom" />,
  EffectComposer: ({ children }: { children: React.ReactNode }) => <div data-testid="postprocessing">{children}</div>,
  Vignette: () => null,
}));
vi.mock("./use-scene-quality", () => ({
  useSceneQuality: () => ({ tier: "high", dpr: 1.5, shadows: true, postprocessing: true, animateAmbient: true }),
}));
vi.mock("./alarm-beacon", () => ({ AlarmBeacon: () => null }));
vi.mock("./control-valve", () => ({ ControlValve: () => null }));
vi.mock("./phase-volumes", () => ({ PhaseVolumes: () => null }));
vi.mock("./process-pipe", () => ({ ProcessPipe: () => null }));
vi.mock("./separator-vessel", () => ({ SeparatorVessel: () => null }));
vi.mock("./scene-readiness", () => ({ establishSceneReadiness: vi.fn(() => () => undefined) }));

import { SeparatorScene } from "./separator-scene";
import { createEquilibriumSample } from "@/hooks/use-simulation";

describe("separator scene presentation profiles", () => {
  it("uses a demand-rendered, non-interactive low-cost profile for presentations", () => {
    render(<SeparatorScene mode="presentation" onSceneError={vi.fn()} onReady={vi.fn()} resetToken={0} sample={createEquilibriumSample()} status="idle" />);

    expect(canvasProps.last).toEqual(expect.objectContaining({ frameloop: "demand", shadows: false }));
    expect(screen.queryByTestId("orbit-controls")).not.toBeInTheDocument();
    expect(screen.queryByTestId("contact-shadows")).not.toBeInTheDocument();
    expect(screen.queryByTestId("postprocessing")).not.toBeInTheDocument();
  });

  it("keeps the full cinematic dashboard profile by default", () => {
    render(<SeparatorScene onSceneError={vi.fn()} onReady={vi.fn()} resetToken={0} sample={createEquilibriumSample()} status="idle" />);

    expect(canvasProps.last).toEqual(expect.objectContaining({ frameloop: "always", shadows: true }));
    expect(screen.getByTestId("orbit-controls")).toBeInTheDocument();
    expect(screen.getByTestId("contact-shadows")).toBeInTheDocument();
    expect(screen.getByTestId("postprocessing")).toBeInTheDocument();
  });
});
