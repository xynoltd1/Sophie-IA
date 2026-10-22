import { describe, expect, it } from "vitest";
import { nombre, texte, vrai } from "@/lib/sophie/tool-types";
import { SOPHIE_TOOLS, findTool, toolDefinitions } from "@/lib/sophie/tools";

/**
 * Lecture des arguments envoyes par le modele.
 *
 * Un modele de langage n'est pas une API : il envoie « 60 » ou 60, « true » ou
 * true, « oui », ou rien du tout, selon son humeur et le fournisseur. Ces
 * fonctions absorbent ces variations. Les tests ci-dessous fixent le
 * comportement attendu sur les formes reellement observees.
 */
describe("lecture des arguments d'un outil", () => {
  it("accepte un nombre ecrit en toutes lettres de chiffres", () => {
    expect(nombre({ d: 60 }, "d")).toBe(60);
    expect(nombre({ d: "60" }, "d")).toBe(60);
    expect(nombre({ d: " 90 " }, "d")).toBe(90);
  });

  it("refuse ce qui n'est pas un nombre", () => {
    expect(nombre({ d: "une heure" }, "d")).toBeNull();
    expect(nombre({ d: "" }, "d")).toBeNull();
    expect(nombre({}, "d")).toBeNull();
    expect(nombre({ d: null }, "d")).toBeNull();
  });

  it("traite une chaine vide comme une absence", () => {
    // Important : Vapi remplit volontiers les parametres absents avec "".
    // Les confondre avec une vraie valeur ecrirait du vide dans le CRM.
    expect(texte({ n: "" }, "n")).toBeNull();
    expect(texte({ n: "   " }, "n")).toBeNull();
    expect(texte({ n: " Jean " }, "n")).toBe("Jean");
  });

  it("comprend les formes affirmatives d'un modele francophone", () => {
    expect(vrai({ u: true }, "u")).toBe(true);
    expect(vrai({ u: "true" }, "u")).toBe(true);
    expect(vrai({ u: "oui" }, "u")).toBe(true);
    expect(vrai({ u: "OUI" }, "u")).toBe(true);
    expect(vrai({ u: false }, "u")).toBe(false);
    expect(vrai({ u: "non" }, "u")).toBe(false);
    expect(vrai({}, "u")).toBe(false);
  });
});

describe("registre des outils", () => {
  it("expose les outils du scenario complet", () => {
    for (const nom of [
      "check_availability",
      "get_business_information",
      "identify_caller",
      "save_caller_details",
      "create_lead",
      "create_task",
      "create_pending_appointment",
      "request_human_transfer",
    ]) {
      expect(findTool(nom), `${nom} manque au registre`).toBeDefined();
    }
  });

  it("ne declare pas deux fois le meme nom", () => {
    const noms = SOPHIE_TOOLS.map((t) => t.definition.name);
    expect(new Set(noms).size).toBe(noms.length);
  });

  it("decrit chaque outil et chacun de ses parametres", () => {
    // La description est la seule chose que le modele lit pour decider quand
    // appeler un outil. Un parametre sans description est un parametre qu'il
    // remplira au hasard.
    for (const outil of SOPHIE_TOOLS) {
      expect(outil.definition.description.length, outil.definition.name).toBeGreaterThan(20);

      const proprietes = (outil.definition.parameters as {
        properties?: Record<string, { description?: string }>;
      }).properties;

      for (const [nom, schema] of Object.entries(proprietes ?? {})) {
        expect(
          schema.description,
          `${outil.definition.name}.${nom} n'a pas de description`,
        ).toBeTruthy();
      }
    }
  });

  it("n'expose aucun outil qui prendrait une decision a la place de l'artisan", () => {
    // Section 22 : Sophie prend un rendez-vous PROVISOIRE. Confirmer, refuser
    // ou annuler appartient au professionnel. Si un outil de ce genre
    // apparaissait ici, ce serait une regression de principe, pas un ajout.
    const interdits = ["confirm_appointment", "cancel_appointment", "reject_appointment"];
    const noms = SOPHIE_TOOLS.map((t) => t.definition.name);

    for (const interdit of interdits) {
      expect(noms, `${interdit} ne doit pas etre accessible a Sophie`).not.toContain(interdit);
    }
  });

  it("fournit des definitions utilisables par un fournisseur de voix", () => {
    const definitions = toolDefinitions();
    expect(definitions.length).toBe(SOPHIE_TOOLS.length);
    for (const def of definitions) {
      expect(def.parameters).toHaveProperty("type", "object");
    }
  });
});
