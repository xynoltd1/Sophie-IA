import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { messageErreurBase } from "../src/lib/db/erreurs";

const lire = (c: string) => readFileSync(resolve(process.cwd(), c), "utf-8");

describe("une migration manquante se dit, elle ne se cache pas", () => {
  it("la colonne de la 0038 renvoie vers la 0038", () => {
    const message = messageErreurBase(
      {
        code: "PGRST204",
        message:
          "Could not find the 'assistant_name_source' column of 'sophie_configurations' in the schema cache",
      },
      "La configuration n’a pas pu être enregistrée.",
    );

    expect(message).toContain("0038_assistante_zeli");
    expect(message).toContain("éditeur SQL");
    expect(message).not.toContain("schema cache");
  });

  it("la table de la 0039 renvoie vers la 0039", () => {
    const message = messageErreurBase(
      { code: "42P01", message: 'relation "public.quotes" does not exist' },
      "Création refusée.",
    );
    expect(message).toContain("0039_devis");
  });

  it("l accueil telephonique renvoie vers la 0036", () => {
    const message = messageErreurBase(
      { code: "42703", message: 'column "spoken_name" does not exist' },
      "Enregistrement refusé.",
    );
    expect(message).toContain("0036_accueil_personnalise");
  });

  it("une absence non repertoriee dit quand meme quoi faire", () => {
    const message = messageErreurBase(
      { code: "42P01", message: 'relation "public.futur" does not exist' },
      "Échec.",
    );
    expect(message).toContain("migrations en attente");
    expect(message).toContain("futur");
  });

  it("le mot « réessayez » n apparait pas pour une colonne manquante", () => {
    // Réessayer ne répare jamais une colonne absente : le mot invite à
    // refaire exactement ce qui vient d échouer.
    const message = messageErreurBase(
      { code: "42703", message: 'column "assistant_name_source" does not exist' },
      "Échec.",
    );
    expect(message).toContain("Appliquez la migration");
  });
});

describe("les autres erreurs ne sont pas masquees", () => {
  it("une contrainte violee reste lisible", () => {
    const message = messageErreurBase(
      { code: "23505", message: "duplicate key value violates unique constraint" },
      "Enregistrement refusé.",
    );
    expect(message).toContain("Enregistrement refusé.");
    expect(message).toContain("duplicate key");
  });

  it("sans erreur, la phrase de secours sert", () => {
    expect(messageErreurBase(null, "Échec.")).toBe("Échec.");
    expect(messageErreurBase(undefined, "Échec.")).toBe("Échec.");
  });

  it("le nom d une table dans un message sans code ne declenche rien", () => {
    // Sinon n importe quelle erreur mentionnant « quotes » enverrait appliquer
    // une migration deja appliquee.
    const message = messageErreurBase(
      { code: "42501", message: "permission denied for table quotes" },
      "Refusé.",
    );
    expect(message).not.toContain("0039");
    expect(message).toContain("permission denied");
  });
});

describe("les ecrans qui ecrivent utilisent la traduction", () => {
  it("l onboarding de Zeli, l accueil et les devis", () => {
    for (const fichier of [
      "src/app/onboarding/sophie/actions.ts",
      "src/app/(app)/app/sophie/accueil/actions.ts",
      "src/app/(app)/app/devis/actions.ts",
    ]) {
      expect(lire(fichier), fichier).toContain("messageErreurBase");
    }
  });

  it("plus aucun « Réessayez » seul dans l onboarding", () => {
    expect(lire("src/app/onboarding/sophie/actions.ts")).not.toContain(
      "Réessayez.\",",
    );
  });
});

describe("un formulaire ne perd pas ce qui a ete tape", () => {
  it("les champs de l onboarding sont pilotes, pas pre-remplis", () => {
    // React remet un formulaire a zero apres une action serveur. Avec
    // `defaultValue`, un echec efface ce que la personne venait d ecrire.
    for (const fichier of [
      "src/app/onboarding/sophie/sophie-form.tsx",
      "src/app/onboarding/appels/phone-form.tsx",
      "src/app/onboarding/metier/profession-picker.tsx",
    ]) {
      const source = lire(fichier);
      const champsTexte = source.match(/defaultValue=\{[a-zA-Z]/g) ?? [];
      expect(champsTexte, `${fichier} perd son texte`).toEqual([]);
    }
  });

  it("chaque champ pilote a bien son etat", () => {
    const form = lire("src/app/onboarding/sophie/sophie-form.tsx");
    expect(form).toContain("const [greetingText, setGreetingText]");
    expect(form).toContain("const [notes, setNotes]");
    expect(form).toContain("value={greetingText}");
    expect(form).toContain("value={notes}");
  });
});

describe("la table de correspondance reste complete", () => {
  it("chaque migration qui ajoute une colonne ecrite par un formulaire y figure", () => {
    const traducteur = lire("src/lib/db/erreurs.ts");
    const migrations = readdirSync(resolve(process.cwd(), "supabase/migrations"));

    // Les migrations 0033 a 0039 apportent des tables et colonnes que des
    // formulaires ecrivent. Si l une manque ici, son erreur sera illisible.
    for (const numero of ["0033", "0034", "0035", "0036", "0038", "0039"]) {
      const existe = migrations.some((f) => f.includes(`_${numero}_`));
      expect(existe, `migration ${numero} absente du dossier`).toBe(true);
      expect(traducteur, `migration ${numero} absente du traducteur`).toContain(
        numero,
      );
    }
  });
});
