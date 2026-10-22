import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkPhone, normalisePhone } from "@/lib/crm/phone";

/**
 * Un numero mal entendu est pire qu'un numero absent.
 *
 * Incident du 2026-10-22 : la transcription a rendu « 04 72 12 34 » pour un
 * numero dicte au telephone. Le serveur l'a enregistre tel quel. L'artisan
 * aurait rappele un numero qui n'existe pas — ou, avec un peu de malchance,
 * quelqu'un qui n'a jamais appele.
 */
describe("normalisation", () => {
  it("ramene les ecritures courantes a la meme forme", () => {
    expect(normalisePhone("0470 12 34 56")).toBe("+32470123456");
    expect(normalisePhone("+32 470 12 34 56")).toBe("+32470123456");
    expect(normalisePhone("0032470123456")).toBe("+32470123456");
    expect(normalisePhone("0470.12.34.56")).toBe("+32470123456");
  });

  it("respecte l'indicatif du pays de l'organisation", () => {
    expect(normalisePhone("06 12 34 56 78", "33")).toBe("+33612345678");
  });

  it("refuse ce qui ne contient aucun chiffre", () => {
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone("   ")).toBeNull();
    expect(normalisePhone("je ne sais pas")).toBeNull();
  });
});

describe("vraisemblance", () => {
  it("accepte un mobile belge et un fixe bruxellois", () => {
    expect(checkPhone("0470 12 34 56").plausible).toBe(true);
    expect(checkPhone("02 123 45 67").plausible).toBe(true);
  });

  it("accepte un numero francais", () => {
    expect(checkPhone("06 12 34 56 78", "33").plausible).toBe(true);
  });

  it("refuse le numero tronque de l'incident", () => {
    const resultat = checkPhone("04 72 12 34");
    expect(resultat.plausible).toBe(false);
    expect(resultat.reason).toMatch(/chiffre par chiffre/);
  });

  it("refuse un numero trop long", () => {
    expect(checkPhone("+3247012345678901234").plausible).toBe(false);
  });

  it("explique toujours pourquoi, en mots prononcables", () => {
    // Le motif est lu a voix haute par Sophie : il doit dire quoi faire,
    // pas decrire une contrainte technique.
    const resultat = checkPhone("04 72 12 34");
    expect(resultat.reason).not.toMatch(/E\.164|regex|invalide/i);
    expect(resultat.reason).toMatch(/repeter|répéter/i);
  });

  it("accepte un pays inconnu plutot que de rejeter un vrai client", () => {
    // Prétendre connaitre tous les plans de numerotation ferait perdre des
    // clients legitimes. On n'ecarte que l'impossible.
    expect(checkPhone("+15551234567").plausible).toBe(true);
    expect(checkPhone("+2348012345678").plausible).toBe(true);
  });
});

/**
 * Regles de provenance, verifiees sur le code.
 *
 * Elles ne sont pas calculables : ce sont des decisions. Un test qui les lit
 * dans le source empeche qu'une refonte les efface sans que personne ne s'en
 * apercoive.
 */
describe("provenance d'un numero", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/lib/sophie/tools-crm.ts"),
    "utf-8",
  );

  it("valide un numero dicte avant de l'ecrire", () => {
    const bloc = source.slice(source.indexOf("const saveCallerDetails"));
    const positionVerification = bloc.indexOf("checkPhone");
    const positionEcriture = bloc.indexOf('.from("contacts")');
    expect(positionVerification).toBeGreaterThan(-1);
    expect(positionVerification).toBeLessThan(positionEcriture);
  });

  it("n'ecrase jamais un numero du reseau par un numero dicte", () => {
    const bloc = source.slice(source.indexOf("const saveCallerDetails"));
    expect(bloc).toMatch(/phone_origin\s*!==\s*"NETWORK"/);
  });

  it("marque la provenance a la creation du contact", () => {
    expect(source).toMatch(/context\.callerNumber \? "NETWORK" : "DICTATED"/);
  });

  it("demande a Sophie de relire le numero avant de l'envoyer", () => {
    const bloc = source.slice(source.indexOf("const saveCallerDetails"));
    expect(bloc).toMatch(/chiffre par chiffre/);
  });
});
