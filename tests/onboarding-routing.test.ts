import { describe, expect, it } from "vitest";
import { STEP_ROUTES } from "@/app/onboarding/steps";
import { ONBOARDING_STEPS } from "@/lib/org/onboarding";

/**
 * Régression : la page /onboarding redirigeait vers la route de l'étape
 * courante. Quand cette étape était ORGANIZATION, la route était cette page
 * elle-même — boucle infinie, transformée par Next en « Application error ».
 */
describe("routage de l'onboarding", () => {
  it("la première étape pointe bien vers la page d'entrée", () => {
    expect(STEP_ROUTES.ORGANIZATION).toBe("/onboarding");
  });

  it("aucune étape ne partage sa route avec une autre", () => {
    const routes = ONBOARDING_STEPS.filter((s) => s !== "DONE").map((s) => STEP_ROUTES[s]);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("chaque étape a une destination définie", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(typeof STEP_ROUTES[step]).toBe("string");
      expect(STEP_ROUTES[step].length).toBeGreaterThan(1);
    }
  });
});
