import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Chaque `onConflict` doit correspondre a une vraie contrainte deductible.
 *
 * PostgreSQL n accepte `ON CONFLICT (a, b, c)` que s il existe une contrainte
 * ou un index unique portant sur ces colonnes **nues**. Un index sur expression
 * — par exemple `coalesce(member_id, ...)` — ne peut PAS etre deduit, meme s il
 * garantit la meme unicite.
 *
 * Cette erreur ne se voit ni au typecheck, ni au lint, ni au build : elle
 * n apparait qu a l execution, au moment ou l ecriture a lieu. Dans la version
 * 0.5.2, elle a fait echouer la connexion d un agenda Google apres que Google
 * eut tout accepte (ADR-025).
 *
 * Ce test relie le code applicatif au schema SQL, les deux seules sources de
 * verite disponibles sans base de donnees.
 */

const RACINE = process.cwd();

function fichiers(dossier: string, extension: string): string[] {
  const resultats: string[] = [];
  for (const entree of readdirSync(resolve(RACINE, dossier), { withFileTypes: true })) {
    const chemin = `${dossier}/${entree.name}`;
    if (entree.isDirectory()) resultats.push(...fichiers(chemin, extension));
    else if (entree.name.endsWith(extension)) resultats.push(chemin);
  }
  return resultats;
}

/** Les colonnes listees dans chaque `onConflict: "..."` du code. */
function cibles(): { fichier: string; colonnes: string[] }[] {
  const trouvees: { fichier: string; colonnes: string[] }[] = [];

  for (const fichier of fichiers("src", ".ts")) {
    const contenu = readFileSync(resolve(RACINE, fichier), "utf-8");
    for (const m of contenu.matchAll(/onConflict:\s*"([^"]+)"/g)) {
      const groupe = m[1];
      if (!groupe) continue;
      trouvees.push({
        fichier,
        colonnes: groupe.split(",").map((c) => c.trim()).filter(Boolean),
      });
    }
  }
  return trouvees;
}

/** Tout le SQL des migrations, concatene dans l ordre d application. */
function sql(): string {
  return fichiers("supabase/migrations", ".sql")
    .sort()
    .map((f) => readFileSync(resolve(RACINE, f), "utf-8"))
    .join("\n");
}

/**
 * Vrai si le schema declare une contrainte deductible sur exactement ces
 * colonnes : cle primaire, contrainte `unique (...)`, ou index unique sur
 * colonnes simples. Un index dont la liste contient une parenthese — donc un
 * appel de fonction — est rejete : c est precisement le cas non deductible.
 */
function contrainteDeductible(colonnes: string[], schema: string): boolean {
  const attendu = colonnes.join(",").replace(/\s+/g, "");

  if (colonnes.length === 1 && colonnes[0]) {
    const colonne = colonnes[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${colonne}\\s+uuid\\s+primary\\s+key`, "i").test(schema)) return true;
    if (new RegExp(`\\b${colonne}\\s+\\w+\\s+primary\\s+key`, "i").test(schema)) return true;
  }

  const listes: string[] = [];
  for (const m of schema.matchAll(/create\s+unique\s+index[^(]*\(([^;]*?)\)\s*(?:nulls[^;]*?)?;/gis)) {
    if (m[1]) listes.push(m[1]);
  }
  for (const m of schema.matchAll(/\bunique\s*\(([^)]*)\)/gi)) {
    if (m[1]) listes.push(m[1]);
  }
  for (const m of schema.matchAll(/\bprimary\s+key\s*\(([^)]*)\)/gi)) {
    if (m[1]) listes.push(m[1]);
  }

  return listes.some((liste) => {
    if (liste.includes("(")) return false; // index sur expression : non deductible.
    const normalisee = liste
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .join(",")
      .replace(/\s+/g, "");
    return normalisee === attendu;
  });
}

describe("upsert et contraintes", () => {
  const schema = sql();

  it("trouve bien les upserts du code", () => {
    expect(cibles().length).toBeGreaterThan(0);
  });

  for (const { fichier, colonnes } of cibles()) {
    it(`${fichier} — ON CONFLICT (${colonnes.join(", ")}) a une contrainte deductible`, () => {
      expect(
        contrainteDeductible(colonnes, schema),
        `Aucune contrainte unique sur colonnes simples (${colonnes.join(", ")}) dans les ` +
          "migrations. PostgreSQL repondra « there is no unique or exclusion constraint " +
          "matching the ON CONFLICT specification » a l'execution. Un index sur expression " +
          "ne compte pas. Voir ADR-025.",
      ).toBe(true);
    });
  }

  it("rejette bien un index sur expression", () => {
    const faux = `create unique index x on t (org_id, coalesce(member_id, '0'::uuid), provider);`;
    expect(contrainteDeductible(["org_id", "member_id", "provider"], faux)).toBe(false);
  });

  it("accepte un index sur colonnes simples, avec ou sans nulls not distinct", () => {
    const simple = `create unique index x on t (org_id, member_id, provider);`;
    const nulls = `create unique index x on t (org_id, member_id, provider) nulls not distinct;`;
    expect(contrainteDeductible(["org_id", "member_id", "provider"], simple)).toBe(true);
    expect(contrainteDeductible(["org_id", "member_id", "provider"], nulls)).toBe(true);
  });
});
