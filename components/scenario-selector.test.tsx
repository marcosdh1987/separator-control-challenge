import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScenarioSelector } from "./scenario-selector";

describe("scenario selector", () => {
  it("shows all six canonical scenarios and marks the water-rich slug as selected", () => {
    render(
      <ScenarioSelector
        disabled={false}
        value="water-rich-slug"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByRole("radio", { name: /water-rich liquid slug/i })).toBeChecked();
    expect(screen.getByText(/raises both total feed and the inlet water fraction/i)).toBeVisible();
  });

  it("creates independent names and ids for multiple selector instances", () => {
    render(<><ScenarioSelector disabled={false} value="normal" onChange={vi.fn()} /><ScenarioSelector disabled={false} value="feed-step" onChange={vi.fn()} /></>);
    const radios = screen.getAllByRole("radio");
    expect(radios[0].getAttribute("name")).not.toBe(radios[6].getAttribute("name"));
    expect(radios[0].id).not.toBe(radios[6].id);
    expect(document.querySelectorAll(`#${radios[0].id}`)).toHaveLength(1);
  });
});
