#!/usr/bin/env node
/**
 * Produit une archive complete de la version courante dans releases/.
 * Le ZIP contient tout le projet, pas seulement les fichiers modifies.
 * Exclut : .env, node_modules, builds, caches, archives precedentes.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const name = `Sophie-IA-v${pkg.version}.zip`;
const outDir = resolve(root, "releases");
const outFile = resolve(outDir, name);

mkdirSync(outDir, { recursive: true });

const EXCLUDES = [
  "node_modules/*",
  ".next/*",
  ".git/*",
  "releases/*",
  "coverage/*",
  // Attention : ne pas ecrire ".env.*" — cela exclurait aussi .env.example,
  // qui DOIT figurer dans l'archive.
  ".env",
  ".env.local",
  ".env.development",
  ".env.staging",
  ".env.production",
  ".env.*.local",
  "*.pem",
  "*.key",
  "*.log",
  ".DS_Store",
  "*.tsbuildinfo",
];

try {
  execFileSync(
    "zip",
    ["-r", "-q", outFile, ".", "-x", ...EXCLUDES],
    { cwd: root, stdio: "inherit" },
  );
} catch {
  console.error(
    "La commande zip n'est pas disponible sur cette machine.\n" +
      "Sur macOS et Linux elle est installee par defaut ; sous Windows, utilisez WSL\n" +
      "ou compressez le dossier a la main en excluant node_modules, .next et .env.",
  );
  process.exit(1);
}

if (!existsSync(outFile)) {
  console.error("L'archive n'a pas ete creee.");
  process.exit(1);
}

console.log(`Archive creee : releases/${name}`);
