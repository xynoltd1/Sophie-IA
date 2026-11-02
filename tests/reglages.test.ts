import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const RACINE = process.cwd();

/**
 * Les ecrans de reglages touchent a ce que Sophie dira a de vrais clients :
 * services, horaires, absences, connaissances. Un ecran de reglage sans
 * controle de droits est une porte ouverte sur la configuration de
 * l entreprise.
 */
function pages(dossier: string): string[] {
  const base = resolve(RACINE, dossier);
  if (!existsSync(base)) return [];
  const resultats: string[] = [];
  for (const entree of readdirSync(base, { withFileTypes: true })) {
    const chemin = `${dossier}/${entree.name}`;
    if (entree.isDirectory()) resultats.push(...pages(chemin));
    else if (entree.name === "page.tsx") resultats.push(chemin);
  }
  return resultats;
}

describe("ecrans de reglages", () => {
  const ecrans = pages("src/app/(app)/app/reglages");

  it("existent", () => {
    expect(ecrans.length).toBeGreaterThanOrEqual(5);
  });

  it("verifient le role avant d afficher quoi que ce soit", () => {
    for (const ecran of ecrans) {
      const contenu = readFileSync(resolve(RACINE, ecran), "utf-8");
      expect(contenu, `${ecran} ne verifie aucun droit`).toContain("can(");

      // Deux formes acceptables, et une seule inacceptable.
      //   - le sommaire masque les entrees interdites : il filtre ;
      //   - la page d equipe est lisible par tous, seules ses actions sont
      //     reservees ;
      //   - toute autre page de reglage renvoie ailleurs.
      const filtre = ecran.endsWith("reglages/page.tsx") || ecran.endsWith("equipe/page.tsx");
      if (!filtre) {
        expect(contenu, `${ecran} ne redirige pas`).toContain("redirect(");
      }
    }
  });

  it("les actions sensibles verifient le role cote serveur", () => {
    // Le controle dans la page cache le bouton ; il n empeche rien. Seul le
    // controle dans l action protege reellement.
    const equipe = readFileSync(
      resolve(RACINE, "src/app/(app)/app/reglages/equipe/actions.ts"),
      "utf-8",
    );
    for (const action of ["inviterMembre", "changerRole", "desactiverMembre"]) {
      const bloc = equipe.slice(equipe.indexOf(`export async function ${action}`));
      expect(bloc.slice(0, 900), `${action} ne verifie pas les droits`).toContain("can(");
    }
  });

  it("un administrateur ne peut pas toucher au proprietaire", () => {
    // Sans cette regle, un administrateur pourrait se promouvoir ou evincer
    // celui qui l a nomme.
    const equipe = readFileSync(
      resolve(RACINE, "src/app/(app)/app/reglages/equipe/actions.ts"),
      "utf-8",
    );
    expect(equipe).toContain("outranks(");
    expect(equipe).toContain('cible.role === "OWNER"');
  });

  it("retirer un membre ne supprime jamais son historique", () => {
    const equipe = readFileSync(
      resolve(RACINE, "src/app/(app)/app/reglages/equipe/actions.ts"),
      "utf-8",
    );
    const bloc = equipe.slice(equipe.indexOf("export async function desactiverMembre"));
    expect(bloc).toContain('status: "SUSPENDED"');
    expect(bloc).not.toContain(".delete()");
  });
});

describe("connaissances de Sophie", () => {
  it("l ecran existe et verifie le droit de configurer", () => {
    const page = readFileSync(
      resolve(RACINE, "src/app/(app)/app/sophie/connaissances/page.tsx"),
      "utf-8",
    );
    expect(page).toContain('"sophie:configure"');
  });

  it("une question frequente exige sa question", () => {
    const actions = readFileSync(
      resolve(RACINE, "src/app/(app)/app/sophie/connaissances/actions.ts"),
      "utf-8",
    );
    expect(actions).toContain('v.kind !== "FAQ" || Boolean(v.question)');
  });
});
