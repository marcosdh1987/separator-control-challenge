import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PROCESS_VIEW_STORAGE_KEY,
  getProcessViewSnapshot,
  getServerProcessViewSnapshot,
  resetProcessViewStore,
  setStoredProcessView,
  subscribeProcessView,
} from "@/components/mimic/process-view-store";

describe("process view store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetProcessViewStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    resetProcessViewStore();
  });

  it("prerenders the scene, whatever the visitor stored", () => {
    window.localStorage.setItem(PROCESS_VIEW_STORAGE_KEY, "diagram");

    expect(getServerProcessViewSnapshot()).toBe("scene");
    expect(getProcessViewSnapshot()).toBe("diagram");
  });

  it("falls back to the scene for an unreadable or unknown preference", () => {
    window.localStorage.setItem(PROCESS_VIEW_STORAGE_KEY, "hologram");
    expect(getProcessViewSnapshot()).toBe("scene");

    resetProcessViewStore();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(getProcessViewSnapshot()).toBe("scene");
  });

  it("notifies subscribers and persists a selection", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeProcessView(listener);

    setStoredProcessView("diagram");

    expect(listener).toHaveBeenCalledOnce();
    expect(getProcessViewSnapshot()).toBe("diagram");
    expect(window.localStorage.getItem(PROCESS_VIEW_STORAGE_KEY)).toBe("diagram");
    unsubscribe();
  });

  it("keeps the selection for the session when storage refuses the write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });

    setStoredProcessView("diagram");

    expect(getProcessViewSnapshot()).toBe("diagram");
  });

  it("follows a preference changed in another tab", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeProcessView(listener);

    window.localStorage.setItem(PROCESS_VIEW_STORAGE_KEY, "diagram");
    window.dispatchEvent(new StorageEvent("storage", { key: PROCESS_VIEW_STORAGE_KEY }));

    expect(listener).toHaveBeenCalled();
    expect(getProcessViewSnapshot()).toBe("diagram");
    unsubscribe();
  });

  it("stops listening once unsubscribed", () => {
    const listener = vi.fn();
    subscribeProcessView(listener)();

    setStoredProcessView("diagram");

    expect(listener).not.toHaveBeenCalled();
  });
});
