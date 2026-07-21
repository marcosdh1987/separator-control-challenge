import type { SceneQuality } from "./use-scene-quality";

export type ScenePresentationMode = "dashboard" | "presentation";

export interface ScenePresentationProfile {
  frameloop: "always" | "demand";
  interactive: boolean;
  contactShadows: boolean;
  environment: boolean;
  quality: SceneQuality;
}

export function selectScenePresentation(
  mode: ScenePresentationMode,
  quality: SceneQuality,
): ScenePresentationProfile {
  if (mode === "presentation") {
    return {
      frameloop: "demand",
      interactive: false,
      contactShadows: false,
      environment: false,
      quality: {
        tier: "low",
        dpr: 1,
        shadows: false,
        postprocessing: false,
        animateAmbient: false,
      },
    };
  }

  return {
    frameloop: "always",
    interactive: true,
    contactShadows: quality.shadows,
    environment: true,
    quality,
  };
}
