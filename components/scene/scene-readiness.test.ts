import { describe, expect, it, vi } from "vitest";

import { establishSceneReadiness, type SceneReadinessAdapter } from "./scene-readiness";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function harness() {
  const compile = deferred();
  let afterRender: (() => void) | null = null;
  let frame = 0;
  let lost = false;
  const unsubscribe = vi.fn();
  const adapter: SceneReadinessAdapter = {
    compile: vi.fn(() => compile.promise),
    invalidate: vi.fn(),
    subscribeAfterRender: vi.fn((callback) => {
      afterRender = callback;
      return unsubscribe;
    }),
    currentFrame: () => frame,
    isContextLost: () => lost,
  };
  return {
    adapter,
    compile,
    unsubscribe,
    render: (nextFrame: number) => { frame = nextFrame; afterRender?.(); },
    loseContext: () => { lost = true; },
  };
}

describe("post-render scene readiness", () => {
  it("does not report ready while compilation is pending or before post-render", async () => {
    const test = harness();
    const onReady = vi.fn();
    establishSceneReadiness(test.adapter, { onReady, onError: vi.fn() });
    await flushPromises();
    expect(onReady).not.toHaveBeenCalled();
    expect(test.adapter.subscribeAfterRender).not.toHaveBeenCalled();
    test.compile.resolve();
    await flushPromises();
    expect(onReady).not.toHaveBeenCalled();
    expect(test.adapter.invalidate).toHaveBeenCalledOnce();
  });

  it("waits through frame zero and signals once after a healthy rendered frame", async () => {
    const test = harness();
    const onReady = vi.fn();
    establishSceneReadiness(test.adapter, { onReady, onError: vi.fn() });
    test.compile.resolve();
    await flushPromises();
    test.render(0);
    expect(onReady).not.toHaveBeenCalled();
    test.render(1);
    test.render(2);
    expect(onReady).toHaveBeenCalledOnce();
    expect(test.unsubscribe).toHaveBeenCalledOnce();
  });

  it("reports compile rejection without readiness", async () => {
    const test = harness();
    const onReady = vi.fn();
    const onError = vi.fn();
    establishSceneReadiness(test.adapter, { onReady, onError });
    const error = new Error("shader compile failed");
    await flushPromises();
    test.compile.reject(error);
    await flushPromises();
    expect(onError).toHaveBeenCalledWith(error);
    expect(onReady).not.toHaveBeenCalled();
  });

  it("reports a lost context before or after rendering", async () => {
    const before = harness();
    const beforeError = vi.fn();
    establishSceneReadiness(before.adapter, { onReady: vi.fn(), onError: beforeError });
    before.loseContext();
    before.compile.resolve();
    await flushPromises();
    expect(beforeError).toHaveBeenCalledOnce();

    const after = harness();
    const afterReady = vi.fn();
    const afterError = vi.fn();
    establishSceneReadiness(after.adapter, { onReady: afterReady, onError: afterError });
    after.compile.resolve();
    await flushPromises();
    after.loseContext();
    after.render(1);
    expect(afterError).toHaveBeenCalledOnce();
    expect(afterReady).not.toHaveBeenCalled();
    expect(after.unsubscribe).toHaveBeenCalledOnce();
  });

  it("cancels and unsubscribes exactly once with all later callbacks inert", async () => {
    const test = harness();
    const onReady = vi.fn();
    const onError = vi.fn();
    const cancel = establishSceneReadiness(test.adapter, { onReady, onError });
    test.compile.resolve();
    await flushPromises();
    cancel();
    cancel();
    test.render(1);
    expect(test.unsubscribe).toHaveBeenCalledOnce();
    expect(onReady).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
