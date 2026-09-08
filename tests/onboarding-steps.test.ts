import { describe, expect, it } from "vitest";
import { STEP_NUMBER, STEP_ROUTES, TOTAL_STEPS } from "@/app/onboarding/steps";
import { ONBOARDING_STEPS } from "@/lib/org/onboarding";

describe("parcours d'onboarding", () => {
  it("chaque étape a une route", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(STEP_ROUTES[step]).toBeTruthy();
    }
  });

  it("les routes sont internes", () => {
    for (const route of Object.values(STEP_ROUTES)) {
      expect(route.startsWith("/")).toBe(true);
      expect(route.startsWith("//")).toBe(false);
    }
  });

  it("la numérotation ne dépasse jamais le total affiché", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(STEP_NUMBER[step]).toBeGreaterThanOrEqual(1);
      expect(STEP_NUMBER[step]).toBeLessThanOrEqual(TOTAL_STEPS);
    }
  });

  it("l'étape finale renvoie vers l'application, pas vers l'onboarding", () => {
    expect(STEP_ROUTES.DONE).toBe("/app");
  });
});
