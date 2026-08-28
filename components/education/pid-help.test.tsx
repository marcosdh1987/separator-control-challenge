import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithLocale } from "@/lib/i18n/test-utils";

import { PidHelp } from "./pid-help";

describe("PidHelp", () => {
  it("opens gain guidance with the friendly name before the technical term", async () => {
    const user = userEvent.setup();
    renderWithLocale(<PidHelp gain="kp" />);

    await user.click(screen.getByRole("button", { name: "Help with Response strength" }));

    expect(screen.getByRole("heading", { name: "Response strength" })).toBeVisible();
    expect(screen.getByText("Proportional gain (Kp)")).toBeVisible();
    expect(screen.getByText("Higher Kp → faster response, but lower stability margin.")).toBeVisible();
  });

  it("supports keyboard dismissal of a mobile help drawer", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    renderWithLocale(<PidHelp gain="ki" />);

    await user.click(screen.getByRole("button", { name: "Help with Offset removal" }));
    expect(screen.getByRole("dialog", { name: "Offset removal" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Offset removal" })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
