"use client";

import { CircleHelp, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import type { GainId } from "@/lib/education/pid-content";
import { useMessages } from "@/lib/i18n/provider";

interface PidHelpProps {
  gain: GainId;
}

function isNarrowViewport(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 720px)").matches;
}

export function PidHelp({ gain }: PidHelpProps) {
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const { gain: gainCopy, gainHelp } = useMessages().education;
  const content = gainCopy[gain];
  const contentId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawer, open]);

  const openHelp = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setDrawer(isNarrowViewport());
    setOpen(true);
  };
  const closeHelp = () => setOpen(false);
  const body = (
    <>
      <div className="pid-help__heading">
        <div>
          <h3 id={`${contentId}-title`}>{content.friendlyName}</h3>
          <p>{content.technicalName}</p>
        </div>
        {drawer ? <button aria-label={gainHelp.close(content.friendlyName)} className="pid-help__close" type="button" onClick={closeHelp}><X aria-hidden="true" /></button> : null}
      </div>
      <p className="pid-help__summary">{content.summary}</p>
      <p>{content.description}</p>
      <div className="pid-help__grid">
        <section><h4>{gainHelp.increaseWhen}</h4><ul>{content.increaseWhen.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section><h4>{gainHelp.tooMuchCanCause}</h4><ul>{content.tooMuchCanCause.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section><h4>{gainHelp.reduceWhen}</h4><ul>{content.reduceWhen.map((item) => <li key={item}>{item}</li>)}</ul></section>
      </div>
      <p className="pid-help__note">{content.importantNote}</p>
    </>
  );

  return (
    <div className="pid-help">
      <button aria-controls={contentId} aria-expanded={open} aria-label={gainHelp.trigger(content.friendlyName)} className="pid-help__trigger" type="button" onClick={openHelp}>
        <CircleHelp aria-hidden="true" /> <span>{content.friendlyName}</span>
      </button>
      {open && drawer ? (
        <div aria-labelledby={`${contentId}-title`} aria-modal="true" className="pid-help__scrim" role="dialog">
          <div className="pid-help__drawer" id={contentId}>{body}</div>
        </div>
      ) : null}
      {open && !drawer ? <div className="pid-help__popover" id={contentId}>{body}</div> : null}
    </div>
  );
}
