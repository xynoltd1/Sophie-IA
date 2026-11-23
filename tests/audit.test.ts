import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * L'audit statique, exécuté avec les tests.
 *
 * Les tests unitaires ne parlent jamais à PostgreSQL ni à un navigateur : ils
 * ne voient donc ni une colonne inventée dans une requête, ni une table sans
 * droits, ni un champ qui se vide après un échec. L'audit compare le code au
 * SQL des migrations et attrape cette famille-là. Le brancher ici évite qu'il
 * devienne un outil qu'on oublie de lancer.
 */
describe("audit statique", () => {
  it("ne releve aucun defaut bloquant", () => {
    let sortie = "";
    try {
      sortie = execFileSync("node", ["scripts/audit.mjs"], {
        encoding: "utf8",
      });
    } catch (erreur) {
      const e = erreur as { stdout?: string };
      throw new Error(`L'audit a releve des defauts :\n${e.stdout ?? erreur}`);
    }
    expect(sortie).toContain("aucun constat");
  });
});
