export interface SceneReadinessAdapter {
  compile: () => Promise<void>;
  invalidate: () => void;
  subscribeAfterRender: (callback: () => void) => () => void;
  currentFrame: () => number;
  isContextLost: () => boolean;
}

export interface SceneReadinessCallbacks {
  onReady: () => void;
  onError: (error: Error) => void;
}

const asError = (reason: unknown) => reason instanceof Error
  ? reason
  : new Error("The 3D scene could not establish a rendered frame.");

/**
 * Compiles all scene programs, then waits for R3F's post-render phase before
 * handing visual ownership to the Canvas. The returned cancellation is inert
 * after the controller reaches either terminal state.
 */
export function establishSceneReadiness(
  adapter: SceneReadinessAdapter,
  callbacks: SceneReadinessCallbacks,
): () => void {
  let cancelled = false;
  let settled = false;
  let unsubscribe: (() => void) | null = null;

  const cleanup = () => {
    const release = unsubscribe;
    unsubscribe = null;
    release?.();
  };
  const fail = (reason: unknown) => {
    if (cancelled || settled) return;
    settled = true;
    cleanup();
    callbacks.onError(asError(reason));
  };

  Promise.resolve()
    .then(adapter.compile)
    .then(() => {
      if (cancelled || settled) return;
      if (adapter.isContextLost()) {
        fail(new Error("The WebGL context was lost before the scene rendered."));
        return;
      }
      adapter.invalidate();
      unsubscribe = adapter.subscribeAfterRender(() => {
        if (cancelled || settled) return;
        try {
          if (adapter.isContextLost()) {
            fail(new Error("The WebGL context was lost while the scene rendered."));
            return;
          }
          if (adapter.currentFrame() <= 0) {
            adapter.invalidate();
            return;
          }
          settled = true;
          cleanup();
          callbacks.onReady();
        } catch (error) {
          fail(error);
        }
      });
    })
    .catch(fail);

  return () => {
    if (cancelled) return;
    cancelled = true;
    cleanup();
  };
}
