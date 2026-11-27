import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PAGE = readFileSync("src/app/mentions-legales/page.tsx", "utf8");

/**
 * L'identité de l'éditeur.
 *
 * Elle vient de deux publications au Moniteur belge, pas d'une supposition.
 * Ces tests existent pour qu'elle ne reparte pas en « À COMPLÉTER » à la
 * faveur d'une refonte de page : une mention légale incomplète est une faute,
 * et une mention légale fausse en est une plus grave.
 */
describe("mentions legales", () => {
  it("le numero d entreprise porte une cle de controle valide", () => {
    // Les deux derniers chiffres valent 97 moins le reste des huit premiers
    // modulo 97. Une erreur de lecture du scan ne passe pas ce test.
    const trouve = PAGE.match(/(\d)(\d{3})\.(\d{3})\.(\d{3})/);
    expect(trouve).not.toBeNull();

    const numero = trouve!.slice(1).join("");
    expect(numero).toHaveLength(10);
    expect(Number(numero.slice(8))).toBe(97 - (Number(numero.slice(0, 8)) % 97));
  });

  it("l editeur, le siege et la gerante sont nommes", () => {
    expect(PAGE).toContain("XYNO");
    expect(PAGE).toContain("Kuilenstraat 16, 3700 Tongeren");
    expect(PAGE).toContain("Zehra Dizer");
    expect(PAGE).toContain("contact@zelicall.com");
  });

  it("l hebergeur est nomme, avec la region d execution", () => {
    // « Hébergé chez un prestataire » ne vaut pas mention : la loi demande le
    // nom et l adresse de l hebergeur.
    expect(PAGE).toContain("Vercel Inc.");
    expect(PAGE).toContain("Supabase, Inc.");
    expect(PAGE).toContain("Francfort");
  });

  it("aucun de ces champs n est reste a completer", () => {
    const identite = PAGE.slice(
      PAGE.indexOf("Éditeur du site"),
      PAGE.indexOf("Propriété intellectuelle"),
    );
    for (const champ of ["raison sociale", "adresse complète", "nom et qualité"]) {
      expect(identite).not.toContain(champ);
    }
  });

  it("le numero de TVA reprend le numero d entreprise", () => {
    // Regle belge : le numero de TVA d une societe assujettie est « BE »
    // suivi de son numero d entreprise. Les deux doivent donc coincider — un
    // ecart ici serait une faute de frappe dans une mention legale.
    const entreprise = PAGE.match(/\(BCE\) : ([\d.]+)/)?.[1];
    const tva = PAGE.match(/TVA : BE ([\d.]+)/)?.[1];
    expect(tva).toBe(entreprise);
  });
});
