import { act, renderHook, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ONBOARDING_STORAGE_KEY, useOnboarding } from "@/hooks/use-onboarding";

describe("useOnboarding", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses defaults during server rendering without accessing browser storage", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    expect(() => renderToString(<OnboardingSnapshot />)).not.toThrow();
    expect(getItem).not.toHaveBeenCalled();
  });

  it("starts with false flags and does not write storage while hydrating", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => useOnboarding());

    expect(result.current.flags).toEqual({
      quickStartDismissed: false,
      guidedTourDismissed: false,
      trainingCompleted: false,
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(setItem).not.toHaveBeenCalled();
  });

  it("loads only known boolean flags and ignores unknown persisted fields", async () => {
    window.localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({ quickStartDismissed: true, unknown: true, trainingCompleted: "yes" }),
    );

    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.flags).toEqual({
      quickStartDismissed: true,
      guidedTourDismissed: false,
      trainingCompleted: false,
    });
  });

  it("recovers from malformed persisted storage", async () => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "not-json");
    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.flags).toEqual({
      quickStartDismissed: false,
      guidedTourDismissed: false,
      trainingCompleted: false,
    });
  });

  it("recovers when browser storage cannot be read", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage access denied");
    });

    const { result } = renderHook(() => useOnboarding());

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.flags).toEqual({
      quickStartDismissed: false,
      guidedTourDismissed: false,
      trainingCompleted: false,
    });
  });

  it("persists quick-start dismissal only when requested", async () => {
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => result.current.dismissQuickStart(false));
    expect(result.current.flags.quickStartDismissed).toBe(true);
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull();

    act(() => result.current.reset());
    act(() => result.current.dismissQuickStart(true));
    expect(JSON.parse(window.localStorage.getItem(ONBOARDING_STORAGE_KEY) ?? "{}")).toMatchObject({
      quickStartDismissed: true,
    });
  });

  it("persists tour dismissal and training completion", async () => {
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => result.current.dismissGuidedTour());
    act(() => result.current.completeTraining());

    expect(result.current.flags).toMatchObject({
      guidedTourDismissed: true,
      trainingCompleted: true,
    });
    expect(JSON.parse(window.localStorage.getItem(ONBOARDING_STORAGE_KEY) ?? "{}")).toMatchObject({
      guidedTourDismissed: true,
      trainingCompleted: true,
    });
  });

  it("does not restore a stale snapshot over a local action during hydration", () => {
    window.localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({
        quickStartDismissed: true,
        guidedTourDismissed: true,
        trainingCompleted: true,
      }),
    );
    const pendingMicrotasks: VoidFunction[] = [];
    vi.stubGlobal("queueMicrotask", (callback: VoidFunction) => pendingMicrotasks.push(callback));

    const { result } = renderHook(() => useOnboarding());

    act(() => result.current.reset());
    act(() => result.current.dismissQuickStart(false));
    act(() => pendingMicrotasks.forEach((callback) => callback()));

    expect(result.current).toMatchObject({
      hydrated: true,
      flags: {
        quickStartDismissed: true,
        guidedTourDismissed: false,
        trainingCompleted: false,
      },
    });
  });
});

function OnboardingSnapshot() {
  const onboarding = useOnboarding();
  return <output>{String(onboarding.flags.quickStartDismissed)}</output>;
}
