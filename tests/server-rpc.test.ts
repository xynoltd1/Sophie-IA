import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Les fonctions SQL appelees par le SERVEUR doivent accepter le serveur.
 *
 * Le bug corrige par la migration 0020 : pendant un appel telephonique, il n y
 * a aucun utilisateur connecte. `auth.uid()` est nul. Toute fonction gardee par
 * un controle d identite personnelle refusait donc l acces, et Sophie
 * repondait « je ne peux pas consulter l agenda » alors que tout fonctionnait.
 *
 * Aucun typecheck, lint, test unitaire ou build ne pouvait voir ce probleme :
 * ce chemin ne s execute que lorsqu un service externe appelle. Ce test est le
 * seul controle local capable de l attraper, et il travaille donc sur le SQL.
 *
 * Voir ADR-027.
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

/** Les fonctions SQL appelees avec le client d administration. */
function rpcServeur(): { fichier: string; nom: string }[] {
  const trouves: { fichier: string; nom: string }[] = [];
  for (const fichier of fichiers("src", ".ts")) {
    const contenu = readFileSync(resolve(RACINE, fichier), "utf-8");
    for (const m of contenu.matchAll(/admin\.rpc\(\s*"([a-z_0-9]+)"/g)) {
      if (m[1]) trouves.push({ fichier, nom: m[1] });
    }
  }
  return trouves;
}

function schema(): string {
  return fichiers("supabase/migrations", ".sql")
    .sort()
    .map((f) => readFileSync(resolve(RACINE, f), "utf-8"))
    .join("\n");
}

/** Le corps de la DERNIERE definition d une fonction (les migrations la remplacent). */
function corpsFonction(nom: string, sql: string): string | null {
  const motif = new RegExp(
    `create or replace function public\\.${nom}\\s*\\(([\\s\\S]*?)\\n\\$\\$;`,
    "g",
  );
  const trouvees = [...sql.matchAll(motif)];
  const derniere = trouvees[trouvees.length - 1];
  return derniere ? derniere[0] : null;
}

describe("fonctions SQL appelees par le serveur", () => {
  const sql = schema();

  it("is_org_member accepte le contexte serveur", () => {
    const corps = corpsFonction("is_org_member", sql);
    expect(corps, "is_org_member introuvable dans les migrations").toBeTruthy();
    expect(
      corps,
      "Sans is_server_context(), tout outil vocal echoue : pendant un appel, " +
        "aucun utilisateur n'est connecte. Voir ADR-027.",
    ).toMatch(/is_server_context\(\)/);
  });

  it("has_org_role reste strictement personnel", () => {
    // Deliberement non relache. Un role appartient a une personne ; le serveur
    // n'en a pas. Si has_org_role acceptait le serveur, une action reservee au
    // proprietaire deviendrait declenchable par n'importe quel chemin serveur.
    const corps = corpsFonction("has_org_role", sql);
    expect(corps).toBeTruthy();
    expect(corps).not.toMatch(/is_server_context\(\)/);
  });

  it("trouve bien les appels serveur du code", () => {
    expect(rpcServeur().length).toBeGreaterThan(0);
  });

  for (const { fichier, nom } of rpcServeur()) {
    it(`${nom} (appelee depuis ${fichier}) n'exige pas un role personnel`, () => {
      const corps = corpsFonction(nom, sql);
      expect(corps, `${nom} n'est definie dans aucune migration`).toBeTruthy();

      expect(
        corps,
        `${nom} est appelee par le serveur mais exige un role personnel ` +
          "(has_org_role). Pendant un appel telephonique, personne n'est " +
          "connecte : cette fonction echouera systematiquement. Voir ADR-027.",
      ).not.toMatch(/if not public\.has_org_role/);
    });
  }
});
