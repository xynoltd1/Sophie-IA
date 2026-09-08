import { describe, expect, it } from "vitest";
import { ONBOARDING_STEPS, nextStep, onboardingProgress } from "@/lib/org/onboarding";

describe("progression de l'onboarding", () => {
  it("commence a 0 % et se termine a 100 %", () => {
    expect(onboardingProgress("ORGANIZATION")).toBe(0);
    expect(onboardingProgress("DONE")).toBe(100);
  });

  it("progresse de maniere monotone", () => {
    const values = ONBOARDING_STEPS.map(onboardingProgress);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });

  it("ne depasse jamais la derniere etape", () => {
    expect(nextStep("PHONE")).toBe("DONE");
    expect(nextStep("DONE")).toBe("DONE");
  });
});
