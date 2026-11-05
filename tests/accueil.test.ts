import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  composerAccueil,
  disclosesAI,
  LONGUEUR_MAX,
  MENTION_IA,
  MODELE_PAR_DEFAUT,
  modelePourMoment,
  momentDeLaJournee,
  premierMessage,
  salutation,
  verifierModele,
} from "../src/lib/sophie/greeting";
import {
  MESSAGES_REFUS,
  reponseAssistant,
  reponseRefus,
  type AccueilPourFournisseur,
} from "../src/lib/sophie/assistant-response";

const RACINE = process.cwd();
const lire = (chemin: string) => readFileSync(resolve(RACINE, chemin), "utf-8");

describe("accueil personnalise par entreprise", () => {
  it("deux entreprises obtiennent deux phrases differentes", () => {
    const plombier = composerAccueil({
      entreprise: "Martin Plomberie",
      assistante: "Sophie",
      moment: "MATIN",
    });
    const agence = composerAccueil({
      entreprise: "Agence Lumière Immobilier",
      assistante: "Léa",
      moment: "MATIN",
    });

    expect(plombier).toBe(
      "Martin Plomberie, bonjour. Je suis Sophie, votre assistante virtuelle. Comment puis-je vous aider ?",
    );
    expect(agence).toBe(
      "Agence Lumière Immobilier, bonjour. Je suis Léa, votre assistante virtuelle. Comment puis-je vous aider ?",
    );

    // Aucune des deux phrases ne contient le nom de l autre entreprise.
    expect(plombier).not.toContain("Lumière");
    expect(agence).not.toContain("Martin");
  });

  it("le nom de l entreprise n est jamais code en dur", () => {
    // Un nom en dur dans le module de composition produirait le meme accueil
    // pour tout le monde, et ne se verrait qu au telephone.
    const greeting = lire("src/lib/sophie/greeting.ts");
    const corps = greeting.slice(greeting.indexOf("export function composerAccueil"));
    expect(corps).not.toMatch(/Sophie IA|Zelicall|Martin|Plomberie/);
    expect(MODELE_PAR_DEFAUT).toContain("{entreprise}");
    expect(MODELE_PAR_DEFAUT).toContain("{assistante}");
  });

  it("deux noms d assistante differents sont respectes", () => {
    const base = { entreprise: "Toiture Dupont", moment: "MATIN" as const };
    expect(composerAccueil({ ...base, assistante: "Sophie" })).toContain(
      "Je suis Sophie",
    );
    expect(composerAccueil({ ...base, assistante: "Camille" })).toContain(
      "Je suis Camille",
    );
  });

  it("une formule modifiee change la phrase prononcee", () => {
    const sur_mesure = composerAccueil({
      modele:
        "Ici {entreprise}. {assistante} à l’appareil, assistante virtuelle. Je vous écoute.",
      entreprise: "Serrurerie Nord",
      assistante: "Alice",
      moment: "SOIR",
    });

    expect(sur_mesure).toBe(
      "Ici Serrurerie Nord. Alice à l’appareil, assistante virtuelle. Je vous écoute.",
    );
    expect(sur_mesure).not.toContain("Comment puis-je vous aider");
  });

  it("une configuration absente donne quand meme un accueil correct", () => {
    const sans_rien = composerAccueil({
      modele: null,
      entreprise: "Jardins de Liège",
      assistante: "Sophie",
      moment: "APRES_MIDI",
    });

    expect(sans_rien).toContain("Jardins de Liège");
    expect(disclosesAI(sans_rien)).toBe(true);
  });

  it("le metier absent ne laisse pas de trou dans la phrase", () => {
    const phrase = composerAccueil({
      modele: "{entreprise}, {moment}. Spécialiste {metier}. Je suis {assistante}, assistante virtuelle.",
      entreprise: "Atelier Vitré",
      assistante: "Sophie",
      metier: null,
      moment: "MATIN",
    });

    expect(phrase).not.toContain("  ");
    expect(phrase).not.toContain(" .");
    expect(phrase).toContain("Atelier Vitré, bonjour.");
  });
});

describe("transparence sur la nature d IA", () => {
  it("une formule qui oublie de le dire se fait completer", () => {
    // Obligation de l article 50 du reglement (UE) 2024/1689. Elle ne depend
    // pas de ce que le client a ecrit dans son formulaire.
    const oubli = composerAccueil({
      modele: "{entreprise}, bonjour. Je suis {assistante}. Je vous écoute.",
      entreprise: "Chauffage Est",
      assistante: "Sophie",
      moment: "MATIN",
    });

    expect(oubli).toContain(MENTION_IA);
    expect(disclosesAI(oubli)).toBe(true);
  });

  it("une formule qui le dit deja n est pas alourdie", () => {
    const correcte = composerAccueil({
      modele: "{entreprise}, bonjour. Assistante virtuelle, je vous écoute.",
      entreprise: "Chauffage Est",
      assistante: "Sophie",
      moment: "MATIN",
    });

    expect(correcte).not.toContain(MENTION_IA);
    expect(correcte.match(/virtuelle/gi)?.length).toBe(1);
  });

  it("aucun reglage ne permet de retirer la mention", () => {
    // Le champ existe en base mais la migration 0019 le verrouille, et
    // l action d enregistrement ne l expose pas.
    // Le champ peut etre NOMME dans un commentaire ; ce qui compte est qu il
    // ne soit jamais ECRIT par cette action.
    const action = lire("src/app/(app)/app/sophie/accueil/actions.ts");
    expect(action).not.toMatch(/disclose_ai\s*[:=]/);

    const migration = lire(
      "supabase/migrations/20261105170000_0036_accueil_personnalise.sql",
    );
    expect(migration).not.toMatch(/alter column disclose_ai|drop .*disclose_ai/);
  });
});

describe("annonce legale d enregistrement", () => {
  const accueil = "Martin Plomberie, bonjour. Je suis Sophie, assistante virtuelle.";
  const annonce = "Cet appel est enregistré afin de traiter votre demande.";

  it("se place apres l accueil par defaut", () => {
    const dit = premierMessage({ accueil, annonce, position: "APRES_ACCUEIL" });
    expect(dit.indexOf("Martin")).toBeLessThan(dit.indexOf("enregistré"));
  });

  it("peut se placer avant", () => {
    const dit = premierMessage({ accueil, annonce, position: "AVANT_ACCUEIL" });
    expect(dit.indexOf("enregistré")).toBeLessThan(dit.indexOf("Martin"));
  });

  it("disparait quand l appel n est pas enregistre, et seulement alors", () => {
    expect(premierMessage({ accueil, annonce: null, position: "APRES_ACCUEIL" })).toBe(
      accueil,
    );

    // L annonce ne vient jamais d un texte saisi : elle vient de
    // recording_allowed(), qui refuse tant que le pays n est pas valide.
    const runtime = lire("src/lib/sophie/runtime.ts");
    expect(runtime).toContain("buildAnnouncement");
    expect(runtime).toContain("annonceComplete.mentionsRecording");
  });

  it("la presentation n est pas dite deux fois", () => {
    // buildAnnouncement rend « Bonjour, ici Sophie… Cet appel est enregistré ».
    // L accueil a deja presente ; seule la partie enregistrement est reprise.
    const runtime = lire("src/lib/sophie/runtime.ts");
    expect(runtime).toContain("partieEnregistrement");
  });
});

describe("formules selon le moment", () => {
  it("le moment est calcule dans le fuseau de l entreprise", () => {
    // 21 h a Bruxelles, mais 19 h UTC. Sans le fuseau, on dirait « bonjour ».
    const instant = new Date("2026-11-05T20:30:00Z");
    expect(momentDeLaJournee(instant, "Europe/Brussels")).toBe("SOIR");
    expect(salutation("SOIR")).toBe("bonsoir");
    expect(momentDeLaJournee(new Date("2026-11-05T08:00:00Z"), "Europe/Brussels")).toBe(
      "MATIN",
    );
  });

  it("un fuseau inconnu ne fait pas echouer l appel", () => {
    expect(() =>
      momentDeLaJournee(new Date(), "Pas/Un/Fuseau"),
    ).not.toThrow();
  });

  it("la formule du soir sert le soir, celle de base le reste du temps", () => {
    const choix = (moment: "MATIN" | "APRES_MIDI" | "SOIR") =>
      modelePourMoment({
        base: "base",
        matin: "matin",
        soir: "soir",
        moment,
        ouvert: true,
      });

    expect(choix("MATIN")).toBe("matin");
    expect(choix("SOIR")).toBe("soir");
    expect(choix("APRES_MIDI")).toBe("base");
  });

  it("hors horaires l emporte sur le moment", () => {
    expect(
      modelePourMoment({
        base: "base",
        matin: "matin",
        horsHoraires: "fermé",
        moment: "MATIN",
        ouvert: false,
      }),
    ).toBe("fermé");
  });
});

describe("ce que le formulaire refuse", () => {
  it("une variable inventee est signalee", () => {
    const problemes = verifierModele("{entreprise} {inexistante} bonjour à tous");
    expect(problemes).toHaveLength(1);
    expect(problemes[0]?.message).toContain("inexistante");
  });

  it("une formule trop longue est refusee", () => {
    const problemes = verifierModele("a".repeat(LONGUEUR_MAX + 1));
    expect(problemes.some((p) => p.message.includes("Trop long"))).toBe(true);
  });

  it("l oubli de la mention d IA n est PAS un refus", () => {
    // Elle est ajoutee a la prononciation. Refuser apprendrait a ecrire la
    // formule magique ; ajouter garantit qu elle est dite.
    expect(verifierModele("{entreprise}, bonjour. Je vous écoute.")).toHaveLength(0);
  });

  it("une formule vide est acceptee : elle signifie « par defaut »", () => {
    expect(verifierModele("")).toHaveLength(0);
  });
});

describe("reponse au fournisseur vocal", () => {
  const accueil: AccueilPourFournisseur = {
    premierMessage: "Martin Plomberie, bonjour. Je suis Sophie, assistante virtuelle.",
    accueil: "Martin Plomberie, bonjour. Je suis Sophie, assistante virtuelle.",
    annonce: null,
    entreprise: "Martin Plomberie",
    assistante: "Sophie",
    metier: "Plombier",
    comportement: null,
    voiceId: "fr-FR-DeniseNeural",
  };

  it("la phrase prononcee est celle de la configuration, par deux chemins", () => {
    const reponse = reponseAssistant("asst_123", accueil);

    // Le chemin documente : la variable que porte l assistant enregistre.
    expect(reponse.assistantOverrides.variableValues.premierMessage).toBe(
      accueil.premierMessage,
    );
    // Le chemin direct, au cas ou il serait honore.
    expect(reponse.assistantOverrides.firstMessage).toBe(accueil.premierMessage);
    // Les deux disent la meme chose : aucun des deux n est seul responsable.
    expect(reponse.assistantOverrides.firstMessage).toBe(
      reponse.assistantOverrides.variableValues.premierMessage,
    );
  });

  it("l assistant garde ses outils : on ne remplace que les mots", () => {
    const reponse = reponseAssistant("asst_123", accueil);
    expect(reponse.assistantId).toBe("asst_123");
    expect(reponse).not.toHaveProperty("assistant");
    expect(reponse.assistantOverrides).not.toHaveProperty("model");
  });

  it("une voix absente ne force pas une voix par defaut dans la reponse", () => {
    const reponse = reponseAssistant("asst_123", { ...accueil, voiceId: null });
    expect(reponse.assistantOverrides.voice).toBeUndefined();
  });

  it("un numero inconnu ne nomme aucune entreprise", () => {
    for (const motif of Object.keys(MESSAGES_REFUS) as (keyof typeof MESSAGES_REFUS)[]) {
      const refus = reponseRefus(motif);
      expect(refus.error.length).toBeGreaterThan(10);
      expect(refus).not.toHaveProperty("assistantId");
      expect(refus).not.toHaveProperty("assistantOverrides");
    }
  });

  it("chaque refus a sa propre phrase", () => {
    const phrases = Object.values(MESSAGES_REFUS);
    expect(new Set(phrases).size).toBe(phrases.length);
  });
});

describe("resolution du numero appele", () => {
  const runtime = lire("src/lib/sophie/runtime.ts");
  const route = lire("src/app/api/voice/assistant/route.ts");

  it("l organisation vient du numero appele, jamais d ailleurs", () => {
    // Pas du modele, pas d un parametre d URL, pas d une variable
    // d environnement : de la table des numeros, via une fonction serveur.
    expect(runtime).toContain("sophie_runtime_for_number");
    expect(runtime).not.toMatch(/SOPHIE_ORG_ID|DEFAULT_ORG/);
  });

  it("un numero inconnu ne tombe jamais sur une autre organisation", () => {
    expect(runtime).toContain('refus: "NUMERO_INCONNU"');
    // Aucun repli : pas de `?? premiere organisation`, pas de limit sans where.
    const sql = lire(
      "supabase/migrations/20261105170000_0036_accueil_personnalise.sql",
    );
    expect(sql).toContain("where n.e164 = public.normalize_phone(numero)");
    expect(sql).toContain("and n.is_active");
  });

  it("une organisation supprimee et une Sophie eteinte sont distinguees", () => {
    expect(runtime).toContain('refus: "ORGANISATION_SUPPRIMEE"');
    expect(runtime).toContain('refus: "SOPHIE_INACTIVE"');
  });

  it("la fonction de resolution est refusee au navigateur", () => {
    const sql = lire(
      "supabase/migrations/20261105170000_0036_accueil_personnalise.sql",
    );
    expect(sql).toContain(
      "revoke all on function public.sophie_runtime_for_number(text) from public, anon, authenticated",
    );
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public, pg_temp");
  });

  it("la requete du fournisseur est authentifiee avant toute lecture", () => {
    const avantVerif = route.slice(0, route.indexOf("accueilPourNumero(numeroAppele)"));
    expect(avantVerif).toContain("verifyRequest");
    expect(avantVerif).toContain("signature invalide");
  });

  it("la route tient dans le delai du fournisseur", () => {
    // 7,5 secondes de bout en bout, non configurable, au-dela desquelles
    // l appel echoue chez un vrai client.
    expect(route).toContain("export const maxDuration = 10");
    expect(route).toContain("7,5 secondes");
  });
});

describe("l ecran montre ce qui sera dit", () => {
  it("l apercu appelle la meme fonction que le serveur", () => {
    // Un apercu qui recomposerait la phrase de son cote finirait par montrer
    // autre chose que ce qui est prononce.
    const editeur = lire("src/app/(app)/app/sophie/accueil/editor.tsx");
    expect(editeur).toContain("composerAccueil");
    expect(editeur).toContain("premierMessage");

    const runtime = lire("src/lib/sophie/runtime.ts");
    expect(runtime).toContain("composerAccueil");
    expect(runtime).toContain("premierMessage");
  });

  it("le module d accueil reste utilisable cote navigateur", () => {
    // Un import server-only ici casserait l apercu au build.
    expect(lire("src/lib/sophie/greeting.ts")).not.toContain('"server-only"');
    expect(lire("src/lib/sophie/assistant-response.ts")).not.toContain(
      '"server-only"',
    );
  });

  it("l ecran est garde par le role", () => {
    const action = lire("src/app/(app)/app/sophie/accueil/actions.ts");
    expect(action).toContain('can(activeOrganization.role, "organization:update")');
  });
});
