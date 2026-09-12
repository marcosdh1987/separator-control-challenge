import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MESSAGES } from "@/lib/i18n/messages";
import { renderWithLocale } from "@/lib/i18n/test-utils";
import { getLesson } from "@/lib/training/lessons";

import { LessonTheory } from "./lesson-theory";

function installWideViewport(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<() => void>();
  const media = {
    get matches() { return matches; },
    media: "(min-width: 761px)",
    onchange: null,
    addEventListener: (_event: string, listener: () => void) => { listeners.add(listener); },
    removeEventListener: (_event: string, listener: () => void) => { listeners.delete(listener); },
    addListener: (listener: () => void) => { listeners.add(listener); },
    removeListener: (listener: () => void) => { listeners.delete(listener); },
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn(() => media));
  return {
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

const lesson = getLesson("what-is-a-separator");
const training = MESSAGES.en.training;
const lessonCopy = training.lesson[lesson.id];
const props = {
  copy: lessonCopy,
  fieldNoteHeading: training.player.fieldNoteHeading,
  heading: training.player.theoryHeading,
  hideLabel: training.player.hideTheory,
  presenting: false,
  readLabel: training.player.readTheory,
  visualKind: lesson.visualKind,
};

afterEach(() => vi.unstubAllGlobals());

describe("LessonTheory", () => {
  it("starts collapsed on compact viewports", () => {
    installWideViewport(false);
    renderWithLocale(<LessonTheory {...props} />);

    expect(screen.getByRole("button", { name: "Read theory" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("img", { name: lessonCopy.visualAlt })).toHaveAttribute("data-visual-variant", "thumbnail");
    expect(screen.getByText(lessonCopy.theory[0])).not.toBeVisible();
  });

  it("starts expanded on wide viewports", () => {
    installWideViewport(true);
    renderWithLocale(<LessonTheory {...props} />);

    expect(screen.getByRole("button", { name: "Hide theory" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(lessonCopy.theory[0])).toBeVisible();
    expect(screen.getByRole("img", { name: lessonCopy.visualAlt })).toHaveAttribute("data-visual-variant", "detail");
  });

  it("preserves a manual choice when the viewport changes", async () => {
    const user = userEvent.setup();
    const viewport = installWideViewport(false);
    renderWithLocale(<LessonTheory {...props} />);

    await user.click(screen.getByRole("button", { name: "Read theory" }));
    act(() => viewport.setMatches(true));
    act(() => viewport.setMatches(false));

    expect(screen.getByRole("button", { name: "Hide theory" })).toHaveAttribute("aria-expanded", "true");
  });

  it("starts open in presentation mode and remains collapsible", async () => {
    const user = userEvent.setup();
    installWideViewport(false);
    renderWithLocale(<LessonTheory {...props} presenting />);

    expect(screen.getByRole("button", { name: "Hide theory" })).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Hide theory" }));
    expect(screen.getByRole("button", { name: "Read theory" })).toHaveAttribute("aria-expanded", "false");
  });
});
