import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { SANS_SUITE, appelEchoue, sansSuite } from "@/lib/crm/calls";

const RACINE = process.cwd();

/**
 * Un appel sans suite est un client qui peut disparaitre en silence.
 *
 * Il a appele, il a parle, et rien n en est sorti : ni demande, ni rendez-vous,
 * ni rappel a passer. Sans ce signal, son appel ne figure que dans une liste
 * que l artisan n ouvre pas, et le client attend un rappel qui ne viendra
 * jamais. C est le seul endroit du produit ou une perte est totalement
 * invisible — d ou sa place sur l accueil (section 30).
 */
const APPEL = {
  status: "COMPLETED" as const,
  is_test: false,
  duration_seconds: 120,
  started_at: "2026-10-22T09:00:00Z",
};
const RIEN = { leads: 0, appointments: 0, tasks: 0 };
const MAINTENANT = new Date("2026-10-22T18:00:00Z");

describe("appel sans suite", () => {
  it("signale un appel termine dont rien n est sorti", () => {
    expect(sansSuite(APPEL, RIEN, MAINTENANT)).toBe(true);
  });

  it("se tait des qu une seule chose en est sortie", () => {
    expect(sansSuite(APPEL, { ...RIEN, leads: 1 }, MAINTENANT)).toBe(false);
    expect(sansSuite(APPEL, { ...RIEN, appointments: 1 }, MAINTENANT)).toBe(false);
    expect(sansSuite(APPEL, { ...RIEN, tasks: 1 }, MAINTENANT)).toBe(false);
  });

  it("ignore les appels d essai", () => {
    // Section 45 : un essai ne reclame rien et ne pollue aucun compteur.
    expect(sansSuite({ ...APPEL, is_test: true }, RIEN, MAINTENANT)).toBe(false);
  });

  it("ignore les raccrochages immediats", () => {
    // Un faux numero n est pas un client a rappeler.
    expect(sansSuite({ ...APPEL, duration_seconds: 4 }, RIEN, MAINTENANT)).toBe(false);
    expect(sansSuite({ ...APPEL, duration_seconds: 14 }, RIEN, MAINTENANT)).toBe(false);
    expect(sansSuite({ ...APPEL, duration_seconds: 15 }, RIEN, MAINTENANT)).toBe(true);
  });

  it("ne cache pas un appel dont la duree est inconnue", () => {
    // Une duree absente est une anomalie du fournisseur, pas un appel court.
    // La traiter comme une duree nulle masquerait le client deux fois.
    expect(sansSuite({ ...APPEL, duration_seconds: null }, RIEN, MAINTENANT)).toBe(true);
  });

  it("oublie les appels trop anciens", () => {
    // Une liste qui ne se vide jamais finit par etre ignoree, et un rappel
    // trois semaines apres ne sert plus personne.
    expect(sansSuite({ ...APPEL, started_at: "2026-10-01T09:00:00Z" }, RIEN, MAINTENANT)).toBe(
      false,
    );
  });

  it("ne parle que des appels termines", () => {
    // Un appel en cours n a pas encore eu le temps de produire quoi que ce soit.
    for (const status of ["RINGING", "ANSWERED", "FAILED", "MISSED", "TRANSFERRED"] as const) {
      expect(sansSuite({ ...APPEL, status }, RIEN, MAINTENANT), status).toBe(false);
    }
  });

  it("compte a part les appels que Sophie n a pas pu prendre", () => {
    expect(appelEchoue({ status: "FAILED", is_test: false })).toBe(true);
    expect(appelEchoue({ status: "MISSED", is_test: false })).toBe(true);
    expect(appelEchoue({ status: "COMPLETED", is_test: false })).toBe(false);
    expect(appelEchoue({ status: "FAILED", is_test: true })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Coherence entre le SQL et le TypeScript
// ---------------------------------------------------------------------------

/** La derniere definition de dashboard_counts, migrations lues dans l ordre. */
function dernierDashboardCounts(): string {
  const dossier = "supabase/migrations";
  const fichiers = readdirSync(resolve(RACINE, dossier))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let derniere = "";
  for (const fichier of fichiers) {
    const contenu = readFileSync(resolve(RACINE, dossier, fichier), "utf-8");
    const m = contenu.match(
      /function public\.dashboard_counts\(org_id uuid\)\s*returns table \(([\s\S]*?)\)\s*language/,
    );
    if (m?.[1]) derniere = m[1];
  }
  return derniere;
}

describe("dashboard_counts : le SQL et le type ne doivent pas divergir", () => {
  it("renvoie exactement les champs declares dans DashboardCounts", () => {
    // Cette divergence ne se voit ni au typecheck, ni au lint, ni au build :
    // la fonction renvoie une colonne de plus ou de moins, et l accueil affiche
    // `undefined` ou zero. Le seul moment ou ca se verrait, c est en production,
    // sur un compteur silencieusement faux.
    const colonnes = dernierDashboardCounts()
      .split(",")
      .map((l) => l.trim().split(/\s+/)[0])
      .filter(Boolean)
      .sort();

    const types = readFileSync(resolve(RACINE, "src/types/database.ts"), "utf-8");
    const bloc = types.match(/export interface DashboardCounts \{([\s\S]*?)\n\}/);
    expect(bloc, "interface DashboardCounts introuvable").not.toBeNull();

    const champs = [...(bloc?.[1] ?? "").matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]).sort();

    expect(colonnes).toEqual(champs);
  });

  it("applique les memes seuils que le code", () => {
    // Le compteur de l accueil est calcule en base, la liste filtree dans le
    // navigateur. Deux endroits pour une seule regle : si les seuils se
    // separent, l accueil annonce « 3 appels » et la liste en montre 5.
    const dossier = "supabase/migrations";
    const sql = readdirSync(resolve(RACINE, dossier))
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => readFileSync(resolve(RACINE, dossier, f), "utf-8"))
      .join("\n");

    const bloc = sql.slice(sql.lastIndexOf("-- Appels sans suite"));
    expect(bloc).toContain(`>= ${SANS_SUITE.DUREE_MINIMUM_SECONDES}`);
    expect(bloc).toContain(`interval '${SANS_SUITE.FENETRE_JOURS} days'`);
  });
});

// ---------------------------------------------------------------------------
// Les heures dictees ne se construisent jamais en UTC
// ---------------------------------------------------------------------------

describe("heures dictees par telephone", () => {
  it("n assemble aucune date murale a la main dans les outils de Sophie", () => {
    // `${date}T${heure}:00Z` lit une heure de pendule comme de l heure
    // universelle : un rendez-vous de 8 h devenait 10 h (ADR-029), et la meme
    // faute decalait l echeance des rappels. La conversion passe par
    // instantDepuisHeureLocale(), jamais par une chaine.
    const dossier = resolve(RACINE, "src/lib/sophie");
    for (const fichier of readdirSync(dossier).filter((f) => f.endsWith(".ts"))) {
      const contenu = readFileSync(resolve(dossier, fichier), "utf-8");
      expect(
        /\$\{\w+\}T\$\{\w+\}/.test(contenu),
        `${fichier} assemble une heure murale a la main`,
      ).toBe(false);
    }
  });
});
