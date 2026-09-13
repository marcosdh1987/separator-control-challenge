import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithLocale } from "@/lib/i18n/test-utils";

import { ProjectAttribution } from "./project-attribution";

describe("ProjectAttribution", () => {
  it("renders the full project note with the author's exact external links", () => {
    renderWithLocale(<ProjectAttribution variant="about" />);

    expect(screen.getByRole("heading", { name: "About this project" })).toBeVisible();
    expect(screen.getByRole("link", { name: "About the author" })).toHaveAttribute("href", "https://marcosdh1987.github.io/cv/");
    expect(screen.getByRole("link", { name: "LinkedIn" })).toHaveAttribute("href", "https://www.linkedin.com/in/marcosesoto/");
    expect(screen.getByRole("link", { name: "Research / ORCID" })).toHaveAttribute("href", "https://orcid.org/0009-0000-5787-5965");
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/marcosdh1987");
    expect(screen.getByRole("link", { name: "Repository" })).toHaveAttribute("href", "https://github.com/marcosdh1987/separator-control-challenge");
  });

  it("renders compact attribution with the repository link", () => {
    renderWithLocale(<ProjectAttribution variant="compact" />);

    expect(screen.getByRole("link", { name: "Marcos Esteban Soto" })).toHaveAttribute("href", "https://marcosdh1987.github.io/cv/");
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/marcosdh1987/separator-control-challenge");
  });

  it("uses the active Spanish locale", () => {
    renderWithLocale(<ProjectAttribution variant="about" />, { locale: "es" });

    expect(screen.getByRole("heading", { name: "Sobre este proyecto" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Sobre el autor" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Investigación / ORCID" })).toBeVisible();
  });
});
