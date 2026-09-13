import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithLocale } from "@/lib/i18n/test-utils";

import { LessonIndex } from "./lesson-index";

describe("LessonIndex attribution", () => {
  it("shows the compact project attribution below the course tools", () => {
    renderWithLocale(<LessonIndex />);

    expect(screen.getByRole("link", { name: "Marcos Esteban Soto" })).toHaveAttribute("href", "https://marcosdh1987.github.io/cv/");
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/marcosdh1987/separator-control-challenge");
  });
});
