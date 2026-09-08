import { describe, expect, it } from "vitest";

/**
 * Régression : une variable NEXT_PUBLIC_ absente au moment du build est
 * remplacée par une chaîne vide, pas par undefined. Les valeurs par défaut de
 * zod ne s'appliquant qu'à undefined, l'application échouait en production
 * alors qu'elle fonctionnait en développement.
 */
describe("normalisation des variables d'environnement", () => {
  function vide(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  it("traite la chaîne vide comme une absence", () => {
    expect(vide("")).toBeUndefined();
    expect(vide("   ")).toBeUndefined();
  });

  it("conserve une vraie valeur", () => {
    expect(vide("https://exemple.supabase.co")).toBe("https://exemple.supabase.co");
  });

  it("laisse undefined tel quel", () => {
    expect(vide(undefined)).toBeUndefined();
  });
});
