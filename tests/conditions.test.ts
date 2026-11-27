import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CGU = readFileSync("src/app/cgu/page.tsx", "utf8");
const CGV = readFileSync("src/app/cgv/page.tsx", "utf8");

/**
 * Les conditions générales.
 *
 * Deux choses sont vérifiées ici, et une seule mérite un test au sens strict :
 * que les prix ne soient pas recopiés dans le document contractuel. Un prix
 * écrit à deux endroits est changé à un seul, et c'est le contrat qui reste
 * faux.
 *
 * L'autre est une sécurité : les quatre clauses qui demandent un juriste
 * doivent rester marquées. Les voir disparaître sans relecture serait pire que
 * de les voir vides.
 */
describe("conditions de vente", () => {
  it("les prix viennent du catalogue, pas du texte", () => {
    expect(CGV).toContain("offresPubliques");
    // Aucun montant d abonnement en dur. Les tarifs de depassement, eux, sont
    // uniformes et assumes dans le texte.
    expect(CGV).not.toMatch(/\d+\s?€\s?(\/|par)\s?mois/);
  });

  it("la vitrine et les conditions disent la meme chose sur la TVA", () => {
    const vitrine = readFileSync("src/app/page.tsx", "utf8");
    expect(vitrine).toContain("hors taxes, par mois");
    expect(CGV).toContain("hors taxes");
  });

  it("les clauses reservees a un juriste restent marquees", () => {
    expect(CGU).toContain("limitation de responsabilité");
    expect(CGV).toContain("intérêts et indemnité forfaitaire");
    expect(CGV).toContain("position retenue, par pays");
    expect(CGV).toContain("organisme de médiation");
  });

  it("le droit applicable est propose, et dit qu il doit etre confirme", () => {
    for (const texte of [CGU, CGV]) {
      expect(texte).toContain("droit belge");
      expect(texte).toContain("confirmée par un juriste");
    }
  });

  it("une panne de l assistante ne perd pas l appel", () => {
    expect(CGU).toContain("comportement de secours");
  });
});
