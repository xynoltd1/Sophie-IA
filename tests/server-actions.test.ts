import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Régression : un fichier « use server » ne peut exporter que des fonctions
 * asynchrones. Un objet exporté provoque « A "use server" file can only export
 * async functions » — au moment de soumettre le formulaire, pas au build. Le
 * bug est donc invisible jusqu'à ce qu'un utilisateur clique.
 *
 * Les types et interfaces sont effacés à la compilation : ils sont autorisés.
 */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("fichiers « use server »", () => {
  const files = walk("src")
    .filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"))
    .filter((path) => readFileSync(path, "utf8").includes('"use server"'));

  it("il existe au moins un fichier d'actions serveur", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("n'exportent que des fonctions asynchrones (ou des types)", () => {
    const fautifs: string[] = [];

    for (const file of files) {
      for (const [index, line] of readFileSync(file, "utf8").split("\n").entries()) {
        if (!line.startsWith("export ")) continue;

        const autorise =
          line.startsWith("export async function") ||
          line.startsWith("export interface") ||
          line.startsWith("export type") ||
          line.startsWith("export enum");

        if (!autorise) {
          fautifs.push(`${file}:${index + 1} → ${line.trim()}`);
        }
      }
    }

    expect(fautifs).toEqual([]);
  });
});
