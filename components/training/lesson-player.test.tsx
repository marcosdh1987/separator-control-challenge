import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MESSAGES } from "@/lib/i18n/messages";
import { renderWithLocale } from "@/lib/i18n/test-utils";

import { LessonPlayer } from "./lesson-player";

vi.mock("./lesson-runner", () => ({
  LessonRunner: () => <div data-testid="lesson-runner" />,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LessonPlayer theory integration", () => {
  it("shows compact authorship outside Presentation Mode and hides it while presenting", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    renderWithLocale(<LessonPlayer lessonId="what-is-a-separator" />);

    expect(screen.getByRole("link", { name: "Marcos Esteban Soto" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Presentation mode" }));
    expect(screen.queryByRole("link", { name: "Marcos Esteban Soto" })).not.toBeInTheDocument();
  });

  it("opens compact theory when presentation mode starts", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    renderWithLocale(<LessonPlayer lessonId="what-is-a-separator" />);

    const paragraph = MESSAGES.en.training.lesson["what-is-a-separator"].theory[0];
    expect(screen.getByText(paragraph)).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "Presentation mode" }));
    expect(screen.getByText(paragraph)).toBeVisible();
  });
});
