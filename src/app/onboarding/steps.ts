import type { OnboardingStep } from "@/types/database";

/** Chemin de chaque étape. L'onboarding est reprenable : on revient toujours ici. */
export const STEP_ROUTES: Record<OnboardingStep, string> = {
  ORGANIZATION: "/onboarding",
  PROFESSION: "/onboarding/metier",
  SERVICES: "/onboarding/services",
  SCHEDULE: "/onboarding/horaires",
  CALENDAR: "/onboarding/agenda",
  SOPHIE: "/onboarding/sophie",
  PHONE: "/onboarding/appels",
  DONE: "/app",
};

export const STEP_NUMBER: Record<OnboardingStep, number> = {
  ORGANIZATION: 1,
  PROFESSION: 2,
  SERVICES: 3,
  SCHEDULE: 4,
  CALENDAR: 5,
  SOPHIE: 6,
  PHONE: 7,
  DONE: 7,
};

export const TOTAL_STEPS = 7;
