import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { QuickStartModal } from "./quick-start-modal";

describe("QuickStartModal", () => {
  it("explains the mission and offers the three first-visit actions", () => {
    render(<QuickStartModal onDismiss={vi.fn()} onStartGuidedTour={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Your mission" })).toBeVisible();
    expect(screen.getByText(/total level near 50%/i)).toBeVisible();
    expect(screen.getByText(/interface near 20%/i)).toBeVisible();
    expect(screen.getByText(/Oil valve LV-101/i)).toBeVisible();
    expect(screen.getByText(/Water valve WV-101/i)).toBeVisible();
    expect(screen.getByText(/Gains lock when an attempt starts/i)).toBeVisible();
    expect(screen.getByRole("list", { name: "How to play" })).toHaveTextContent("Choose a scenario");
    expect(screen.getByRole("button", { name: "Start guided tour" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Skip and play" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Don't show again" })).toBeVisible();
  });

  it("distinguishes session dismissal, persistence dismissal, and a tour request", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onStartGuidedTour = vi.fn();
    render(<QuickStartModal onDismiss={onDismiss} onStartGuidedTour={onStartGuidedTour} />);

    await user.click(screen.getByRole("button", { name: "Skip and play" }));
    expect(onDismiss).toHaveBeenCalledWith(false);

    await user.click(screen.getByRole("button", { name: "Don't show again" }));
    expect(onDismiss).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole("button", { name: "Start guided tour" }));
    expect(onStartGuidedTour).toHaveBeenCalledOnce();
  });

  it("closes on Escape and restores focus to its opener", async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    const opener = screen.getByRole("button", { name: "Open quick start" });
    await user.click(opener);
    expect(screen.getByRole("button", { name: "Start guided tour" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Your mission" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("isolates the background and traps focus until it closes", async () => {
    const user = userEvent.setup();
    render(<AccessibilityHarness />);

    const background = screen.getByText("Background control");
    const first = screen.getByRole("button", { name: "Start guided tour" });
    const last = screen.getByRole("button", { name: "Don't show again" });
    expect(background).toHaveAttribute("aria-hidden", "true");
    expect(background.inert).toBe(true);

    last.focus();
    await user.tab();
    expect(first).toHaveFocus();
    first.focus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();

    background.focus();
    await user.tab();
    expect(first).toHaveFocus();
    background.focus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Skip and play" }));
    expect(screen.queryByRole("dialog", { name: "Your mission" })).not.toBeInTheDocument();
    expect(background).toHaveAttribute("aria-hidden", "false");
    expect(background.inert).toBe(false);
  });

  it("restores focus only after the opener is interactive again", async () => {
    const user = userEvent.setup();
    const originalFocus = HTMLElement.prototype.focus;
    const openerFocusInertStates: boolean[] = [];
    const focus = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function focus(this: HTMLElement, options?: FocusOptions) {
      if (this.textContent === "Open quick start") openerFocusInertStates.push(Boolean(this.inert));
      originalFocus.call(this, options);
    });
    render(<ModalHarness />);

    await user.click(screen.getByRole("button", { name: "Open quick start" }));
    openerFocusInertStates.length = 0;
    await user.keyboard("{Escape}");

    expect(openerFocusInertStates).toEqual([false]);
    focus.mockRestore();
  });

  it("does not restore focus to a disconnected opener", async () => {
    const user = userEvent.setup();
    const originalFocus = HTMLElement.prototype.focus;
    const openerFocuses: HTMLElement[] = [];
    const focus = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function focus(this: HTMLElement, options?: FocusOptions) {
      if (this.textContent === "Remove on close") openerFocuses.push(this);
      originalFocus.call(this, options);
    });
    render(<DetachedOpenerHarness />);

    await user.click(screen.getByRole("button", { name: "Remove on close" }));
    openerFocuses.length = 0;
    await user.click(screen.getByRole("button", { name: "Skip and play" }));

    expect(openerFocuses).toEqual([]);
    focus.mockRestore();
  });
});

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)}>Open quick start</button>
    {open ? <QuickStartModal onDismiss={() => setOpen(false)} onStartGuidedTour={() => setOpen(false)} /> : null}
  </>;
}

function AccessibilityHarness() {
  const [open, setOpen] = useState(true);
  return <>
    <button aria-hidden="false" ref={(element) => { if (element) element.inert = false; }} type="button">Background control</button>
    {open ? <QuickStartModal onDismiss={() => setOpen(false)} onStartGuidedTour={() => setOpen(false)} /> : null}
  </>;
}

function DetachedOpenerHarness() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(true);
  if (!mounted) return <p>Closed</p>;
  return <>
    <button type="button" onClick={() => setOpen(true)}>Remove on close</button>
    {open ? <QuickStartModal onDismiss={() => setMounted(false)} onStartGuidedTour={() => setMounted(false)} /> : null}
  </>;
}
