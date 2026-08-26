import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScenarioSelector } from "./scenario-selector";
import { MESSAGES } from "@/lib/i18n/messages";
import { renderWithLocale } from "@/lib/i18n/test-utils";
import type { ScenarioId } from "@/lib/simulation/types";

describe("scenario selector", () => {
  it("shows every canonical scenario and marks the water-rich slug as selected", () => {
    renderWithLocale(
      <ScenarioSelector
        disabled={false}
        value="water-rich-slug"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(7);
    expect(screen.getByRole("radio", { name: /water-rich liquid slug/i })).toBeChecked();
    expect(screen.getByText(/raises both total feed and the inlet water fraction/i)).toBeVisible();
  });

  it("groups the scenarios progressively and recommends only the first scored challenge", () => {
    renderWithLocale(<ScenarioSelector disabled={false} value="normal" onChange={vi.fn()} />);

    expect(screen.getByRole("region", { name: "Beginner scenarios" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Intermediate scenarios" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Advanced scenarios" })).toBeVisible();
    expect(screen.getByText("Start here")).toBeVisible();
    expect(screen.getByRole("radio", { name: /oil\/water feed step/i }).closest("label")).toHaveTextContent("Start here");
    expect(screen.getByRole("radio", { name: /normal operation/i }).closest("label")).not.toHaveTextContent("Start here");
  });

  it("keeps the approved scenario order inside every difficulty group", () => {
    renderWithLocale(<ScenarioSelector disabled={false} value="normal" onChange={vi.fn()} />);

    expect(within(screen.getByRole("region", { name: "Beginner scenarios" })).getAllByRole<HTMLInputElement>("radio").map((radio) => radio.value)).toEqual(["normal", "feed-step"]);
    expect(within(screen.getByRole("region", { name: "Intermediate scenarios" })).getAllByRole<HTMLInputElement>("radio").map((radio) => radio.value)).toEqual(["slow-water-dump", "oil-outlet-restriction"]);
    expect(within(screen.getByRole("region", { name: "Advanced scenarios" })).getAllByRole<HTMLInputElement>("radio").map((radio) => radio.value)).toEqual(["water-rich-slug", "noisy-interface", "gor-surge"]);
  });

  it("renders approved difficulty badges on cards without legacy difficulty labels", () => {
    renderWithLocale(<ScenarioSelector disabled={false} value="normal" onChange={vi.fn()} />);

    const expectedBadges = {
      normal: "Beginner",
      "feed-step": "Beginner",
      "slow-water-dump": "Intermediate",
      "oil-outlet-restriction": "Intermediate",
      "water-rich-slug": "Advanced",
      "noisy-interface": "Advanced",
      "gor-surge": "Advanced",
    } as const;
    for (const [scenarioId, badge] of Object.entries(expectedBadges)) {
      // The accessible name is the whole card, so match the published scenario
      // name inside it rather than guessing a pattern from the identifier.
      const name = MESSAGES.en.simulation.scenario[scenarioId as ScenarioId].name;
      const pattern = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const card = screen.getByRole("radio", { name: pattern }).closest("label")!;
      expect(within(card).getByTestId("difficulty-badge")).toHaveTextContent(badge);
    }
    expect(screen.queryByText("Foundations")).not.toBeInTheDocument();
    expect(screen.getAllByText("Intermediate")).toHaveLength(3);
    expect(screen.getAllByText("Advanced")).toHaveLength(4);
  });

  it("creates independent names and ids for multiple selector instances", () => {
    renderWithLocale(<><ScenarioSelector disabled={false} value="normal" onChange={vi.fn()} /><ScenarioSelector disabled={false} value="feed-step" onChange={vi.fn()} /></>);
    const radios = screen.getAllByRole("radio");
    expect(radios[0].getAttribute("name")).not.toBe(radios[7].getAttribute("name"));
    expect(radios[0].id).not.toBe(radios[7].id);
    expect(document.querySelectorAll(`#${radios[0].id}`)).toHaveLength(1);
  });
});
