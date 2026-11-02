import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { nettoyerDonnees, transcriptionEnTexte } from "@/lib/calls/intelligence";
import { lireJson } from "@/lib/providers/ai/openai";
import { MockAIProvider } from "@/lib/providers/ai/mock";
import { champsExtraits } from "@/lib/crm/extraction";

/**
 * Le resume et l extraction sont desormais produits par nous (ADR-031).
 *
 * La regle qui gouverne tout ce fichier : ne jamais afficher a l artisan une
 * information que personne n a dite. Un champ absent est honnete ; un champ
 * qui dit « inconnu » encombre ; un champ invente ment.
 */
describe("transcription donnee au modele", () => {
  it("nomme les intervenants sans souffler le nom du client", () => {
    // Le nom reel fait partie de ce que l extraction doit TROUVER. Le donner
    // d avance reviendrait a lui faire confirmer un nom peut-etre mal entendu.
    const texte = transcriptionEnTexte([
      { speaker: "SOPHIE", content: "Bonjour, ici Sophie." },
      { speaker: "CLIENT", content: "Je suis Eugene Bosset." },
    ]);
    expect(texte).toBe("Sophie : Bonjour, ici Sophie.\nClient : Je suis Eugene Bosset.");
  });
});

describe("nettoyage de l extraction", () => {
  it("ecarte les facons de dire « je ne sais pas »", () => {
    expect(
      nettoyerDonnees({
        customer_name: "Eugene Bosset",
        address: "",
        service: "inconnu",
        requested_date: "N/A",
        problem_description: "   ",
        intent: "RENDEZ_VOUS",
      }),
    ).toEqual({ customer_name: "Eugene Bosset", intent: "RENDEZ_VOUS" });
  });

  it("garde les faux booleens, qui sont des reponses", () => {
    // `false` n est pas une absence : « le client n a pas demande de rappel »
    // est une information.
    expect(nettoyerDonnees({ callback_requested: false })).toEqual({ callback_requested: false });
  });

  it("renvoie null quand il ne reste rien", () => {
    expect(nettoyerDonnees({ a: "", b: "inconnu" })).toBeNull();
    expect(nettoyerDonnees(null)).toBeNull();
  });

  it("coupe les espaces autour des valeurs gardees", () => {
    expect(nettoyerDonnees({ city: "  Tongeren " })).toEqual({ city: "Tongeren" });
  });
});

describe("lecture du JSON renvoye par un modele", () => {
  it("accepte un objet nu", () => {
    expect(lireJson('{"intent":"URGENCE"}')).toEqual({ intent: "URGENCE" });
  });

  it("accepte un objet encadre de balises de code", () => {
    // Les modeles ajoutent volontiers ```json, meme quand on demande du JSON.
    expect(lireJson('```json\n{"intent":"DEVIS"}\n```')).toEqual({ intent: "DEVIS" });
  });

  it("accepte un objet noye dans du texte", () => {
    expect(lireJson('Voici :\n{"intent":"SUIVI"}\nVoila.')).toEqual({ intent: "SUIVI" });
  });

  it("refuse ce qui n est pas un objet", () => {
    expect(lireJson("pas du json")).toBeNull();
    expect(lireJson("[1,2,3]")).toBeNull();
  });
});

describe("fournisseur simule", () => {
  it("annonce franchement qu il simule", async () => {
    // Le cahier des charges interdit de faire passer une simulation pour un
    // resultat reel. Le seul moyen de tenir cette promesse est que le texte le
    // dise, et que `isMock` remonte jusqu a l ecran.
    const mock = new MockAIProvider();
    expect(mock.isMock).toBe(true);

    const resultat = await mock.complete({ system: "s", user: "Sophie : bonjour" });
    expect(resultat.text).toContain("SIMULATION");
  });

  it("n invente aucun champ en extraction", async () => {
    const mock = new MockAIProvider();
    const resultat = await mock.complete({
      system: "s",
      user: "u",
      json: { name: "x", schema: {} },
    });
    expect(resultat.json).toEqual({ intent: "INCONNU" });
  });
});

describe("affichage des champs extraits", () => {
  it("montre l urgence en premier", () => {
    const champs = champsExtraits({ customer_name: "Eugene", urgency: "URGENTE" });
    expect(champs[0]?.cle).toBe("urgency");
  });

  it("traduit les booleens", () => {
    const champs = champsExtraits({ appointment_requested: true, callback_requested: false });
    expect(champs.map((c) => c.valeur)).toEqual(["oui", "non"]);
  });

  it("n affiche rien quand il n y a rien", () => {
    expect(champsExtraits(null)).toEqual([]);
    expect(champsExtraits({})).toEqual([]);
  });
});

describe("coherence entre la migration et le code", () => {
  it("les colonnes du resume existent en base", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20261102100000_0025_summary_pipeline.sql"),
      "utf-8",
    );
    for (const colonne of [
      "summary_attempts",
      "summary_error",
      "summary_source",
      "summary_generated_at",
    ]) {
      expect(sql, `${colonne} manque a la migration`).toContain(colonne);
    }
  });

  it("le type TypeScript declare les memes colonnes", () => {
    const types = readFileSync(resolve(process.cwd(), "src/types/database.ts"), "utf-8");
    for (const colonne of ["summary_attempts", "summary_error", "summary_source"]) {
      expect(types).toContain(`${colonne}:`);
    }
  });
});
