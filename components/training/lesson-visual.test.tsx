import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LESSON_VISUAL_KINDS } from "@/lib/training/types";

import { LessonVisual } from "./lesson-visual";

describe("LessonVisual", () => {
  it("renders one accessible SVG for every supported concept", () => {
    for (const kind of LESSON_VISUAL_KINDS) {
      const label = `Accessible ${kind}`;
      const { unmount } = render(
        <LessonVisual alt={label} kind={kind} variant="thumbnail" />,
      );

      const visual = screen.getByRole("img", { name: label });
      expect(visual).toHaveAttribute("data-visual-kind", kind);
      expect(visual).toHaveAttribute("data-visual-variant", "thumbnail");
      expect(screen.getAllByRole("img")).toHaveLength(1);
      unmount();
    }
  });
});
