import { describe, expect, it } from "vitest";
import { CHAMPS_EXTRACTION, analysisPlan } from "@/lib/sophie/analysis";

/**
 * Le premier appel reel a produit un rapport dont le champ `summary` etait
 * vide : l analyse n etait pas activee chez le fournisseur. Rien ne le
 * signalait — ni erreur, ni journal. Le plan vit donc dans le code, il est
 * pousse par un script, et ces tests fixent ce qu il doit contenir.
 */
describe("plan d analyse pousse au fournisseur", () => {
  const plan = analysisPlan();

  it("active le resume et l extraction", () => {
    expect(plan.summaryPlan.enabled).toBe(true);
    expect(plan.structuredDataPlan.enabled).toBe(true);
  });

  it("n invente pas de note de reussite", () => {
    // Un score de « reussite » produit par un modele est un chiffre que
    // personne ne peut expliquer a l artisan.
    expect(plan.successEvaluationPlan.enabled).toBe(false);
  });

  it("couvre les champs de la section 15", () => {
    for (const champ of [
      "intent",
      "service",
      "urgency",
      "customer_name",
      "address",
      "requested_date",
      "requested_time",
      "problem_description",
      "appointment_requested",
      "callback_requested",
    ]) {
      expect(CHAMPS_EXTRACTION, `${champ} manque au schema`).toContain(champ);
    }
  });

  it("n exige aucun champ, et ne le dit pas avec un tableau vide", () => {
    // Un schema qui exige une valeur pousse le modele a en fabriquer une
    // (section 15). Mais `required: []` est INVALIDE en OpenAPI 3.0 : le
    // fournisseur rejette alors tout le plan, sans message, et le rapport
    // revient sans analyse. L absence de la cle dit la meme chose.
    expect("required" in plan.structuredDataPlan.schema).toBe(false);
  });

  it("decrit chaque champ", () => {
    // La description est tout ce que le modele lit pour decider quoi mettre.
    for (const [nom, schema] of Object.entries(plan.structuredDataPlan.schema.properties)) {
      expect((schema as { description?: string }).description?.length ?? 0, nom).toBeGreaterThan(
        15,
      );
    }
  });

  it("interdit d inventer, dans les deux instructions", () => {
    const resume = plan.summaryPlan.messages.map((m) => m.content).join(" ");
    const donnees = plan.structuredDataPlan.messages.map((m) => m.content).join(" ");
    for (const texte of [resume, donnees]) {
      expect(texte).toMatch(/jamais une information qui n'a pas été dite/);
    }
  });

  it("passe la transcription aux deux instructions", () => {
    const resume = plan.summaryPlan.messages.map((m) => m.content).join(" ");
    const donnees = plan.structuredDataPlan.messages.map((m) => m.content).join(" ");
    expect(resume).toContain("{{transcript}}");
    expect(donnees).toContain("{{transcript}}");
  });

  it("ecrit le resume pour un artisan presse", () => {
    const systeme = plan.summaryPlan.messages[0]?.content ?? "";
    expect(systeme).toContain("français");
    expect(systeme).toMatch(/trois phrases au maximum/);
  });
});
