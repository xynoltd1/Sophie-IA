import { describe, expect, it } from "vitest";
import { disclosesAI } from "@/lib/sophie/announcement";

/**
 * L'annonce de transparence.
 *
 * Article 50 du reglement (UE) 2024/1689, applicable depuis le 2 aout 2026.
 * L'enjeu de ces tests est de refuser les formulations qui SEMBLENT suffire :
 * c'est la faute probable, bien plus qu'une absence totale d'annonce.
 */
describe("annonce de la nature d'IA", () => {
  it("accepte les formulations qui disent vraiment la nature automatisee", () => {
    expect(disclosesAI("Vous parlez a un assistant virtuel.")).toBe(true);
    expect(disclosesAI("Je suis une assistante virtuelle.")).toBe(true);
    expect(disclosesAI("Ceci est un systeme automatise.")).toBe(true);
    expect(disclosesAI("Je suis une intelligence artificielle.")).toBe(true);
  });

  it("fonctionne avec et sans accents", () => {
    expect(disclosesAI("Vous parlez à un système automatisé.")).toBe(true);
    expect(disclosesAI("Je suis une intelligence artificielle, bonjour.")).toBe(true);
  });

  it("refuse une presentation qui pourrait decrire un humain", () => {
    // C'est le coeur du sujet. Une secretaire peut etre humaine ; un appelant
    // qui entend cette phrase n'apprend rien sur la nature de son
    // interlocuteur, et l'obligation n'est pas remplie.
    expect(disclosesAI("Bonjour, je suis Sophie, l'assistante de M. Dupont.")).toBe(false);
    expect(disclosesAI("Bonjour, ici le secretariat de l'entreprise.")).toBe(false);
    expect(disclosesAI("Sophie a l'appareil, que puis-je faire pour vous ?")).toBe(false);
  });

  it("refuse une annonce qui ne parle que de l'enregistrement", () => {
    // Informer de l'enregistrement est une autre obligation, qui ne remplace
    // pas celle-ci.
    expect(disclosesAI("Cet appel est enregistre afin de traiter votre demande.")).toBe(false);
  });
});
