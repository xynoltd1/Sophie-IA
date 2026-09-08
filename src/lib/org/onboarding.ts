import type { OnboardingStep } from "@/types/database";

/** Ordre des etapes d'onboarding (section 6 du cahier des charges). */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  "ORGANIZATION",
  "PROFESSION",
  "SERVICES",
  "SCHEDULE",
  "CALENDAR",
  "SOPHIE",
  "PHONE",
  "DONE",
];

export const ONBOARDING_LABELS: Record<OnboardingStep, string> = {
  ORGANIZATION: "Votre entreprise",
  PROFESSION: "Votre metier",
  SERVICES: "Vos services",
  SCHEDULE: "Vos horaires",
  CALENDAR: "Votre agenda",
  SOPHIE: "Sophie",
  PHONE: "Vos appels",
  DONE: "Termine",
};

/** Progression en pourcentage, affichee pendant l'onboarding. */
export function onboardingProgress(step: OnboardingStep): number {
  const index = ONBOARDING_STEPS.indexOf(step);
  const total = ONBOARDING_STEPS.length - 1; // DONE = 100 %
  if (index < 0) return 0;
  return Math.round((index / total) * 100);
}

export function nextStep(step: OnboardingStep): OnboardingStep {
  const index = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[Math.min(index + 1, ONBOARDING_STEPS.length - 1)] ?? "DONE";
}
