import { render, screen } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SceneErrorBoundary } from "./scene-error-boundary";

class MaybeThrows extends Component<{ fail: boolean }> {
  render(): ReactNode {
    if (this.props.fail) throw new Error("canvas lost");
    return <div>WebGL process scene</div>;
  }
}

describe("scene error boundary", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
  afterEach(() => vi.restoreAllMocks());

  it("catches scene errors and renders the supplied accessible fallback", () => {
    render(<SceneErrorBoundary fallback={<section aria-label="Process fallback">Fallback cutaway</section>}><MaybeThrows fail /></SceneErrorBoundary>);
    expect(screen.getByRole("region", { name: "Process fallback" })).toHaveTextContent("Fallback cutaway");
  });

  it("recovers when its reset key changes", () => {
    const { rerender } = render(<SceneErrorBoundary fallback={<div>Fallback cutaway</div>} resetKey="failed"><MaybeThrows fail /></SceneErrorBoundary>);
    expect(screen.getByText("Fallback cutaway")).toBeVisible();
    rerender(<SceneErrorBoundary fallback={<div>Fallback cutaway</div>} resetKey="recovered"><MaybeThrows fail={false} /></SceneErrorBoundary>);
    expect(screen.getByText("WebGL process scene")).toBeVisible();
  });
});
