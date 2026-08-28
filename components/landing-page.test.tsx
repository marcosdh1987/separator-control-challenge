import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithLocale } from "@/lib/i18n/test-utils";

const processHeroMock = vi.hoisted(() => vi.fn(() => <div data-testid="presentation-hero" />));

vi.mock("./process-hero", () => ({
  ProcessHero: processHeroMock,
}));

import { LandingPage } from "./landing-page";

describe("landing page", () => {
  it("introduces the challenge and directs new operators to training or the control room", () => {
    renderWithLocale(<LandingPage />);

    expect(screen.getByRole("heading", { name: "Separator Control Challenge" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Can you keep a three-phase separator stable?" })).toBeVisible();
    expect(screen.getByText("Tune two PID control loops, survive realistic well-testing disturbances, and keep the process inside its safe operating envelope.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Start guided training" })).toHaveAttribute("href", "/training");
    expect(screen.getByRole("link", { name: "Enter control room" })).toHaveAttribute("href", "/challenge");
  });

  it("explains the two valve relationships, operating goals, and educational boundary", () => {
    renderWithLocale(<LandingPage />);

    expect(screen.getByText("Oil outlet valve controls total liquid level.")).toBeVisible();
    expect(screen.getByText("Water outlet valve controls oil/water interface.")).toBeVisible();
    expect(screen.getByText(/total near 50%, interface near 20%/i)).toBeVisible();
    expect(screen.getByText(/Educational simulator/i)).toBeVisible();
    expect(screen.getByText(/Not for field operation or equipment sizing/i)).toBeVisible();
  });

  it("passes a static equilibrium sample to the hero's explicit presentation mode", () => {
    renderWithLocale(<LandingPage />);

    expect(processHeroMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "presentation",
        status: "idle",
        sample: expect.objectContaining({
          timeS: 0,
          total: expect.objectContaining({ processValuePct: 50 }),
          interface: expect.objectContaining({ processValuePct: 20 }),
        }),
      }),
      undefined,
    );
  });

  it("renders the mission, call to action, and control note in Spanish", () => {
    renderWithLocale(<LandingPage />, { locale: "es" });

    expect(screen.getByRole("heading", { name: "¿Puedes mantener estable un separador trifásico?" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Empezar el entrenamiento guiado" })).toHaveAttribute("href", "/training");
    expect(screen.getByText("La válvula de salida de agua controla la interfase petróleo/agua.")).toBeVisible();
  });
});
