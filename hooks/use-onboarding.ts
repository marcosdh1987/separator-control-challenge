"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  DEFAULT_ONBOARDING_FLAGS,
  type OnboardingFlag,
  type OnboardingFlags,
} from "@/lib/onboarding/types";

export const ONBOARDING_STORAGE_KEY = "separator-control-onboarding-v1";

const ONBOARDING_FLAG_KEYS: readonly OnboardingFlag[] = [
  "quickStartDismissed",
  "guidedTourDismissed",
  "trainingCompleted",
];

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseFlags(value: string | null): OnboardingFlags {
  if (!value) return { ...DEFAULT_ONBOARDING_FLAGS };

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_ONBOARDING_FLAGS };

    const flags = { ...DEFAULT_ONBOARDING_FLAGS };
    for (const key of ONBOARDING_FLAG_KEYS) {
      const candidate = (parsed as Record<string, unknown>)[key];
      if (typeof candidate === "boolean") flags[key] = candidate;
    }
    return flags;
  } catch {
    return { ...DEFAULT_ONBOARDING_FLAGS };
  }
}

function readStoredFlags(): OnboardingFlags {
  try {
    return parseFlags(getStorage()?.getItem(ONBOARDING_STORAGE_KEY) ?? null);
  } catch {
    return { ...DEFAULT_ONBOARDING_FLAGS };
  }
}

export function useOnboarding() {
  const [flags, setFlags] = useState<OnboardingFlags>(() => ({ ...DEFAULT_ONBOARDING_FLAGS }));
  const [hydrated, setHydrated] = useState(false);
  const flagsRef = useRef(flags);
  const mutationVersionRef = useRef(0);

  const updateFlags = useCallback((changes: Partial<OnboardingFlags>, persist: boolean) => {
    mutationVersionRef.current += 1;
    const nextFlags = { ...flagsRef.current, ...changes };
    flagsRef.current = nextFlags;
    setFlags(nextFlags);

    if (!persist) return;

    try {
      getStorage()?.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(nextFlags));
    } catch {
      // Storage can be disabled or unavailable in privacy-constrained contexts.
    }
  }, []);

  useEffect(() => {
    const restoredFlags = readStoredFlags();
    const hydrationVersion = mutationVersionRef.current;
    let active = true;

    queueMicrotask(() => {
      if (!active) return;
      if (mutationVersionRef.current === hydrationVersion) {
        flagsRef.current = restoredFlags;
        setFlags(restoredFlags);
      }
      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const dismissQuickStart = useCallback(
    (persist: boolean) => updateFlags({ quickStartDismissed: true }, persist),
    [updateFlags],
  );
  const dismissGuidedTour = useCallback(
    () => updateFlags({ guidedTourDismissed: true }, true),
    [updateFlags],
  );
  const completeTraining = useCallback(
    () => updateFlags({ trainingCompleted: true }, true),
    [updateFlags],
  );
  const reset = useCallback(() => {
    mutationVersionRef.current += 1;
    const defaults = { ...DEFAULT_ONBOARDING_FLAGS };
    flagsRef.current = defaults;
    setFlags(defaults);
    try {
      getStorage()?.removeItem(ONBOARDING_STORAGE_KEY);
    } catch {
      // Storage can be disabled or unavailable in privacy-constrained contexts.
    }
  }, []);

  return {
    flags,
    hydrated,
    dismissQuickStart,
    dismissGuidedTour,
    completeTraining,
    reset,
  };
}
