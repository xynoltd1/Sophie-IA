import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { ASSISTANTE_PAR_DEFAUT, PLATEFORME } from "../src/lib/brand";

const RACINE = process.cwd();
const lire = (c: string) => readFileSync(resolve(RACINE, c), "utf-8");

const MIGRATION = lire(
  "supabase/migrations/20261106140000_0038_assistante_zeli.sql",
);

/** Tous les fichiers de code, pour un balayage global. */
function sources(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(resolve(RACINE, dossier), {
    withFileTypes: true,
  })) {
    const chemin = `${dossier}/${entree.name}`;
    if (entree.isDirectory()) sources(chemin, acc);
    else if (/\.(ts|tsx)$/.test(entree.name)) acc.push(chemin);
  }
  return acc;
}

describe("les deux noms sont distincts", () => {
  it("Zelicall est la plateforme, Zeli est l assistante", () => {
    expect(PLATEFORME).toBe("Zelicall");
    expect(ASSISTANTE_PAR_DEFAUT).toBe("Zeli");
  });

  it("le nom du site vient de la constante, pas d une chaine recopiee", () => {
    const site = lire("src/lib/seo/site.ts");
    expect(site).toContain("export const SITE_NAME = PLATEFORME");
  });
});

describe("plus aucune mention commerciale de l ancien nom", () => {
  it("aucun texte visible ne dit encore Sophie", () => {
    const fautifs: string[] = [];

    for (const fichier of sources("src")) {
      const texte = lire(fichier);
      for (const [index, ligne] of texte.split("\n").entries()) {
        if (!ligne.includes("Sophie")) continue;

        // Les identifiants techniques restent : table, fonction, dossier,
        // route, discriminant. Les renommer casserait la base et les
        // imports, pour un nom que personne ne voit.
        const technique =
          /sophie_configurations|sophie_runtime_for_number|@\/lib\/sophie|lib\/sophie|app\/sophie|onboarding\/sophie|sophie-form|"sophie"|SOPHIE/.test(
            ligne,
          );
        if (!technique) fautifs.push(`${fichier}:${index + 1}`);
      }
    }

    expect(fautifs, `mentions visibles restantes : ${fautifs.join(", ")}`).toEqual(
      [],
    );
  });

  it("les illustrations ne disent pas Sophie non plus", () => {
    for (const fichier of readdirSync(resolve(RACINE, "public/illustrations"))) {
      expect(lire(`public/illustrations/${fichier}`)).not.toContain("Sophie");
    }
  });
});

describe("la migration ne peut pas ecraser un nom choisi", () => {
  it("elle distingue l herite du choisi avant de renommer", () => {
    expect(MIGRATION).toContain("assistant_name_source");
    expect(MIGRATION).toContain("check (\n    assistant_name_source in ('DEFAULT', 'CUSTOM')");

    // Le renommage porte UNIQUEMENT sur ce qui est marque herite.
    const renommage = MIGRATION.slice(
      MIGRATION.indexOf("set assistant_name = 'Zeli'"),
    );
    expect(renommage).toContain("where assistant_name_source = 'DEFAULT'");
    expect(renommage).toContain("btrim(assistant_name) = 'Sophie'");
  });

  it("un nom jamais vu comme defaut est marque choisi", () => {
    expect(MIGRATION).toContain("btrim(assistant_name) not in ('Sophie', 'Zeli')");
  });

  it("un passage par l ecran d accueil vaut un choix", () => {
    // `greeting_updated_at` est pose par la migration 0036 a chaque
    // enregistrement : le nom affiche a ce moment-la a donc ete vu et garde.
    expect(MIGRATION).toContain("greeting_updated_at is not null");
  });

  it("le defaut des nouveaux comptes devient Zeli", () => {
    expect(MIGRATION).toContain("alter column assistant_name set default 'Zeli'");
    expect(MIGRATION).toContain("coalesce(c.assistant_name, 'Zeli')");
  });

  it("enregistrer un nom le marque definitivement comme choisi", () => {
    // Sans cela, la prochaine migration de renommage l ecraserait.
    for (const action of [
      "src/app/(app)/app/sophie/accueil/actions.ts",
      "src/app/onboarding/sophie/actions.ts",
    ]) {
      expect(lire(action)).toContain('assistant_name_source: "CUSTOM"');
    }
  });
});

describe("ce que la migration ne touche pas", () => {
  it("les tables et fonctions gardent leur nom", () => {
    // Les renommer casserait les types generes, les requetes et
    // l historique des migrations, pour un nom qui ne sort jamais de la base.
    expect(MIGRATION).toContain("public.sophie_configurations");
    expect(MIGRATION).toContain("public.sophie_runtime_for_number");
    expect(MIGRATION).not.toMatch(/alter table .* rename to/i);
  });

  it("aucune URL publique n a change", () => {
    // Changer une adresse publique sans redirection perd le referencement
    // acquis et casse les liens deja partages.
    const chemins = lire("src/lib/seo/site.ts");
    for (const chemin of ["/", "/signup", "/mentions-legales", "/cgu", "/cgv"]) {
      expect(chemins).toContain(`"${chemin}"`);
    }
  });
});

describe("illustrations", () => {
  const FICHIERS = readdirSync(resolve(RACINE, "public/illustrations"));

  it("chaque illustration est un SVG valide et sans script", () => {
    expect(FICHIERS.length).toBeGreaterThanOrEqual(9);
    for (const fichier of FICHIERS) {
      const svg = lire(`public/illustrations/${fichier}`);
      expect(fichier.endsWith(".svg"), `${fichier} n est pas un SVG`).toBe(true);
      expect(svg).toContain("viewBox=");
      // Un script dans une illustration est un vecteur d execution, et une
      // ressource externe est une dependance qu on ne controle pas.
      expect(svg, `${fichier} contient un script`).not.toMatch(/<script|onload=|javascript:/i);
      expect(svg, `${fichier} charge une ressource externe`).not.toMatch(/href="http|url\(http|<image/i);
    }
  });

  it("chacune porte un titre decrivant la scene", () => {
    for (const fichier of FICHIERS) {
      const svg = lire(`public/illustrations/${fichier}`);
      expect(svg, `${fichier} sans role img`).toContain('role="img"');
      const titre = svg.match(/<title[^>]*>([^<]+)<\/title>/)?.[1] ?? "";
      expect(titre.length, `${fichier} : titre trop court`).toBeGreaterThan(40);
    }
  });

  it("chacune respecte la preference de mouvement reduit", () => {
    // Une image chargee par une balise `img` n herite d aucune feuille de
    // style de la page : la regle doit etre DANS le fichier.
    for (const fichier of FICHIERS) {
      const svg = lire(`public/illustrations/${fichier}`);
      if (!svg.includes("@keyframes")) continue;
      expect(svg, `${fichier} anime sans garde-fou`).toContain(
        "prefers-reduced-motion",
      );
    }
  });

  it("aucune n est assez lourde pour ralentir la page", () => {
    for (const fichier of FICHIERS) {
      const poids = lire(`public/illustrations/${fichier}`).length;
      expect(poids, `${fichier} pese ${Math.round(poids / 1024)} ko`).toBeLessThan(
        24_000,
      );
    }
  });

  it("chaque illustration posee dans la page a une alternative ecrite", () => {
    const page = lire("src/app/page.tsx");

    // Les quatre vignettes d etapes passent par `etape.alt` : leur texte est
    // dans le tableau ETAPES, pas dans l appel.
    const litterales = [...page.matchAll(/alt="([^"]*)"/g)].map((m) => m[1]);
    const depuisDonnees = [...page.matchAll(/^\s{4}alt: "([^"]*)",$/gm)].map(
      (m) => m[1],
    );
    const alts = [...litterales, ...depuisDonnees].filter(
      (a): a is string => typeof a === "string",
    );

    expect(alts.length).toBeGreaterThanOrEqual(7);
    expect(page.match(/alt=\{etape\.alt\}/)).not.toBeNull();

    for (const alt of alts) {
      expect(alt.length, `alternative trop courte : « ${alt} »`).toBeGreaterThan(
        30,
      );
    }
  });

  it("les dimensions sont toujours donnees", () => {
    // Sans elles, le navigateur ne reserve pas la place et le texte saute
    // quand l image arrive.
    const composant = lire("src/components/public/illustration.tsx");
    expect(composant).toContain("width={largeur}");
    expect(composant).toContain("height={hauteur}");
  });
});
