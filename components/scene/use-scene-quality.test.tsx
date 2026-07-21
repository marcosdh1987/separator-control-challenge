import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { selectSceneQuality, useSceneQuality } from "./use-scene-quality";

describe("scene quality policy", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [{ width: 719, dpr: 1, reducedMotion: false }, "low", 1, false, false],
    [{ width: 720, dpr: 1, reducedMotion: false }, "medium", 1.25, true, true],
    [{ width: 1279, dpr: 2.5, reducedMotion: false }, "medium", 1.25, true, true],
    [{ width: 1280, dpr: 2.5, reducedMotion: false }, "high", 1.5, true, true],
    [{ width: 1440, dpr: 2.5001, reducedMotion: false }, "low", 1, false, false],
  ] as const)("selects exact boundaries for %o", (input, tier, dpr, shadows, postprocessing) => {
    expect(selectSceneQuality(input)).toEqual({
      tier,
      dpr,
      shadows,
      postprocessing,
      animateAmbient: true,
    });
  });

  it("disables ambient motion without changing the render tier", () => {
    expect(selectSceneQuality({ width: 1440, dpr: 2, reducedMotion: true })).toEqual({
      tier: "high",
      dpr: 1.5,
      shadows: true,
      postprocessing: true,
      animateAmbient: false,
    });
  });

  it.each([
    { width: Number.NaN, dpr: Number.NaN, reducedMotion: false },
    { width: 0, dpr: 0, reducedMotion: false },
    { width: Number.POSITIVE_INFINITY, dpr: Number.POSITIVE_INFINITY, reducedMotion: false },
  ])("returns a finite conservative policy for invalid browser values", (input) => {
    const quality = selectSceneQuality(input);
    expect(quality.tier).toBe("low");
    expect(quality.dpr).toBe(1);
  });

  it("responds to resize and reduced-motion changes and cleans up listeners", () => {
    const listeners = new Map<string, EventListener>();
    const mediaListeners = new Set<(event: MediaQueryListEvent) => void>();
    const media = {
      matches: false,
      addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.add(listener)),
      removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.delete(listener)),
    } as unknown as MediaQueryList;
    vi.stubGlobal("matchMedia", vi.fn(() => media));
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener) => listeners.set(type, listener as EventListener));
    vi.spyOn(window, "removeEventListener").mockImplementation((type) => listeners.delete(type));
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440, writable: true });
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2, writable: true });

    const { result, unmount } = renderHook(() => useSceneQuality());
    expect(result.current.tier).toBe("high");

    act(() => {
      window.innerWidth = 600;
      listeners.get("resize")?.(new Event("resize"));
    });
    expect(result.current.tier).toBe("low");

    act(() => {
      Object.defineProperty(media, "matches", { configurable: true, value: true });
      mediaListeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
    });
    expect(result.current.animateAmbient).toBe(false);

    unmount();
    expect(listeners.has("resize")).toBe(false);
    expect(mediaListeners.size).toBe(0);
  });
});
