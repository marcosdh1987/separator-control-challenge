import type { Locale } from "../locale";
import { challenge as challengeEn } from "./en/challenge";
import { common as commonEn } from "./en/common";
import { education as educationEn } from "./en/education";
import { landing as landingEn } from "./en/landing";
import { onboarding as onboardingEn } from "./en/onboarding";
import { research as researchEn } from "./en/research";
import { simulation as simulationEn } from "./en/simulation";
import { training as trainingEn } from "./en/training";
import { challenge as challengeEs } from "./es/challenge";
import { common as commonEs } from "./es/common";
import { education as educationEs } from "./es/education";
import { landing as landingEs } from "./es/landing";
import { onboarding as onboardingEs } from "./es/onboarding";
import { research as researchEs } from "./es/research";
import { simulation as simulationEs } from "./es/simulation";
import { training as trainingEs } from "./es/training";

const en = {
  common: commonEn,
  landing: landingEn,
  challenge: challengeEn,
  onboarding: onboardingEn,
  education: educationEn,
  simulation: simulationEn,
  training: trainingEn,
  research: researchEn,
};

/**
 * English is canonical: every other locale is typed against it, so a missing or
 * misspelled key is a compile error rather than a blank space at runtime.
 */
export type Messages = typeof en;

const es: Messages = {
  common: commonEs,
  landing: landingEs,
  challenge: challengeEs,
  onboarding: onboardingEs,
  education: educationEs,
  simulation: simulationEs,
  training: trainingEs,
  research: researchEs,
};

export const MESSAGES: Record<Locale, Messages> = { en, es };
