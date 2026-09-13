"use client";

import { useMessages } from "@/lib/i18n/provider";
import type { ReactNode } from "react";

export const PROJECT_LINKS = {
  portfolio: "https://marcosdh1987.github.io/cv/",
  linkedin: "https://www.linkedin.com/in/marcosesoto/",
  orcid: "https://orcid.org/0009-0000-5787-5965",
  github: "https://github.com/marcosdh1987",
  repository: "https://github.com/marcosdh1987/separator-control-challenge",
} as const;

type ProjectAttributionProps =
  | { variant: "about" }
  | { variant: "compact" };

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} rel="noreferrer" target="_blank">
      {children}<span aria-hidden="true"> ↗</span>
    </a>
  );
}

export function ProjectAttribution({ variant }: ProjectAttributionProps) {
  const messages = useMessages();

  if (variant === "compact") {
    const copy = messages.common.attribution;
    return (
      <footer className="project-attribution project-attribution-compact">
        <span>{copy.project}</span>
        <span aria-hidden="true">·</span>
        <ExternalLink href={PROJECT_LINKS.portfolio}>{copy.author}</ExternalLink>
        <span aria-hidden="true">·</span>
        <ExternalLink href={PROJECT_LINKS.repository}>{copy.github}</ExternalLink>
      </footer>
    );
  }

  const copy = messages.landing.about;
  return (
    <section aria-labelledby="project-about-title" className="project-attribution project-attribution-about">
      <div className="project-attribution-copy">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2 id="project-about-title">{copy.title}</h2>
        <p>{copy.description}</p>
        <p>{copy.aiNote}</p>
      </div>
      <div className="project-attribution-links">
        <p className="eyebrow">{copy.invitation}</p>
        <nav aria-label={copy.title}>
          <ul>
            <li><ExternalLink href={PROJECT_LINKS.portfolio}>{copy.links.author}</ExternalLink></li>
            <li><ExternalLink href={PROJECT_LINKS.linkedin}>{copy.links.linkedin}</ExternalLink></li>
            <li><ExternalLink href={PROJECT_LINKS.orcid}>{copy.links.orcid}</ExternalLink></li>
            <li><ExternalLink href={PROJECT_LINKS.github}>{copy.links.github}</ExternalLink></li>
            <li><ExternalLink href={PROJECT_LINKS.repository}>{copy.links.repository}</ExternalLink></li>
          </ul>
        </nav>
      </div>
    </section>
  );
}
