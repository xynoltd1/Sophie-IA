import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const RACINE = process.cwd();

function fichiers(dossier: string, extension = /\.tsx?$/): string[] {
  const base = resolve(RACINE, dossier);
  const resultats: string[] = [];
  for (const entree of readdirSync(base, { withFileTypes: true })) {
    const chemin = `${dossier}/${entree.name}`;
    if (entree.isDirectory()) resultats.push(...fichiers(chemin, extension));
    else if (extension.test(entree.name)) resultats.push(chemin);
  }
  return resultats;
}

function lire(chemin: string): string {
  return readFileSync(resolve(RACINE, chemin), "utf-8");
}

describe("frontiere client / serveur", () => {
  /**
   * Un composant marque `"use client"` ne peut pas importer un module
   * `server-only` : le build casse, et seul le build le dit. Le typecheck
   * passe, les tests passent, et l erreur n apparait qu a la fin.
   *
   * C est arrive en ajoutant l ecran des taches : la liste cochable importait
   * un libelle depuis le module de requete. Un libelle ne vaut pas de
   * ramener le client Supabase dans le navigateur.
   */
  it("aucun composant client n importe un module server-only", () => {
    const serveurSeulement = new Set(
      fichiers("src/lib", /\.ts$/)
        .filter((f) => lire(f).includes('import "server-only"'))
        .map((f) => f.replace(/^src\//, "@/").replace(/\.ts$/, "")),
    );

    expect(serveurSeulement.size).toBeGreaterThan(3);

    for (const fichier of fichiers("src")) {
      const contenu = lire(fichier);
      if (!contenu.includes('"use client"')) continue;

      for (const chemin of serveurSeulement) {
        // `import type` disparait a la compilation : il ne ramene aucun code
        // dans le paquet du navigateur et ne casse pas le build. Seul un
        // import de valeur compte.
        const valeur = new RegExp(
          String.raw`import\s+(?!type\s)\{[^}]*\}\s+from\s+"${chemin}"`,
        );
        expect(
          valeur.test(contenu),
          `${fichier} importe ${chemin}, qui est server-only`,
        ).toBe(false);
      }
    }
  });
});

describe("design system", () => {
  const css = lire("src/app/globals.css");
  const sources = fichiers("src")
    .map((f) => lire(f))
    .join("\n");

  it("n expose pas de jeton mort", () => {
    // Un jeton declare et jamais employe est une intention, pas une decision.
    // Celui-la s est deja produit : `paper-deep` est reste six semaines dans la
    // feuille de style avec un commentaire expliquant son role, sans qu aucune
    // barre ne l utilise.
    const declares = [...css.matchAll(/--color-([a-z-]+):/g)]
      .map((m) => m[1])
      .filter((nom): nom is string => Boolean(nom));

    expect(declares.length).toBeGreaterThan(8);

    for (const nom of declares) {
      const employe =
        sources.includes(`-${nom}`) ||
        sources.includes(`${nom}"`) ||
        css.includes(`var(--color-${nom})`);
      expect(employe, `--color-${nom} n est utilise nulle part`).toBe(true);
    }
  });

  it("garde une seule definition des puces de filtre", () => {
    // Chaque liste avait sa variante de puce, avec sa hauteur et sa couleur.
    // Une puce doit se reconnaitre d un ecran a l autre.
    const chip = lire("src/components/ui/chip.tsx");
    expect(chip).toContain("rounded-pill");

    for (const fichier of fichiers("src/app")) {
      const contenu = lire(fichier);
      if (!contenu.includes('aria-label="Filtrer')) continue;
      expect(contenu, `${fichier} redessine ses puces`).toContain("<Chip");
    }
  });

  it("respecte la cible tactile minimale", () => {
    // 44 px est le minimum confortable pour un pouce ; le design system
    // annonce 48 px pour les actions. Un bouton de 32 px se rate.
    for (const fichier of fichiers("src")) {
      const contenu = lire(fichier);
      for (const trouve of contenu.matchAll(/min-h-(\d+)/g)) {
        const valeur = Number(trouve[1]);
        // Tailwind : 1 unite = 0.25rem = 4 px. min-h-11 = 44 px.
        expect(
          valeur,
          `${fichier} contient une cible de ${valeur * 4} px`,
        ).toBeGreaterThanOrEqual(11);
      }
    }
  });
});
