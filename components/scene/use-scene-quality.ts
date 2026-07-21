"use client";

import { useEffect, useState } from "react";

export type SceneQualityTier = "low" | "medium" | "high";

export interface SceneQualityInput {
  width: number;
  dpr: number;
  reducedMotion: boolean;
}

export interface SceneQuality {
  tier: SceneQualityTier;
  dpr: 1 | 1.25 | 1.5;
  shadows: boolean;
  postprocessing: boolean;
  animateAmbient: boolean;
}

export function selectSceneQuality(input: SceneQualityInput): SceneQuality {
  const validWidth = Number.isFinite(input.width) && input.width > 0;
  const validDpr = Number.isFinite(input.dpr) && input.dpr > 0;
  const tier: SceneQualityTier = !validWidth || !validDpr || input.width < 720 || input.dpr > 2.5
    ? "low"
    : input.width < 1280
      ? "medium"
      : "high";
  const enhanced = tier !== "low";

  return {
    tier,
    dpr: tier === "low" ? 1 : tier === "medium" ? 1.25 : 1.5,
    shadows: enhanced,
    postprocessing: enhanced,
    animateAmbient: !input.reducedMotion,
  };
}

const browserInput = (): SceneQualityInput => {
  if (typeof window === "undefined") return { width: 0, dpr: 0, reducedMotion: false };
  return {
    width: window.innerWidth,
    dpr: window.devicePixelRatio,
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  };
};

export function useSceneQuality(): SceneQuality {
  const [quality, setQuality] = useState(() => selectSceneQuality(browserInput()));

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setQuality(selectSceneQuality({
      width: window.innerWidth,
      dpr: window.devicePixelRatio,
      reducedMotion: media.matches,
    }));
    update();
    window.addEventListener("resize", update);
    media.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      media.removeEventListener("change", update);
    };
  }, []);

  return quality;
}
