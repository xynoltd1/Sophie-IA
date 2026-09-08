#!/usr/bin/env node
/**
 * Diagnostic de la configuration de test.
 *
 * N'affiche JAMAIS la valeur d'une cle : seulement son nom, sa longueur et
 * quelques defauts frequents. Le resultat peut etre partage sans risque.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const file = resolve(root, ".env.local");

console.log("\n--- Diagnostic de .env.local ---\n");

if (!existsSync(file)) {
  console.log("Fichier introuvable a la racine du projet.");
  console.log("Attendu ici :", file);
  process.exit(1);
}

const bytes = readFileSync(file);
console.log("Fichier trouve, taille :", bytes.length, "octets");

// Encodages qui empechent la lecture des variables.
if (bytes[0] === 0xff && bytes[1] === 0xfe) {
  console.log("PROBLEME : le fichier est encode en UTF-16.");
  console.log("Reenregistrez-le en UTF-8 (Bloc-notes : Fichier > Enregistrer sous > Encodage UTF-8).");
  process.exit(1);
}

const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
if (hasBom) {
  console.log("Note : le fichier commence par un BOM UTF-8. Sans effet ici, mais evitable.");
}

const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
const lines = text.split(/\r?\n/);

const ATTENDU = [
  "SUPABASE_TEST_URL",
  "SUPABASE_TEST_ANON_KEY",
  "SUPABASE_TEST_SERVICE_ROLE_KEY",
];

const trouve = new Map();
const anomalies = [];

for (const [index, raw] of lines.entries()) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;

  const eq = line.indexOf("=");
  if (eq < 0) {
    anomalies.push(`Ligne ${index + 1} : pas de signe egal. Une cle coupee en deux ?`);
    continue;
  }

  const name = line.slice(0, eq);
  const value = line.slice(eq + 1);

  if (name !== name.trim()) {
    anomalies.push(`Ligne ${index + 1} : espace avant le signe egal.`);
  }
  if (value.startsWith(" ")) {
    anomalies.push(`Ligne ${index + 1} : espace apres le signe egal.`);
  }
  if (/^["']/.test(value) && /["']$/.test(value)) {
    anomalies.push(`Ligne ${index + 1} : la valeur est entre guillemets, a retirer.`);
  }

  trouve.set(name.trim(), value.trim());
}

console.log("\nVariables attendues :");
let complet = true;
for (const name of ATTENDU) {
  const value = trouve.get(name);
  if (!value) {
    complet = false;
    console.log(`  ${name} : ABSENTE`);
  } else if (value.length < 20) {
    complet = false;
    console.log(`  ${name} : presente mais trop courte (${value.length} caracteres) — valeur d'exemple ?`);
  } else {
    console.log(`  ${name} : OK (${value.length} caracteres)`);
  }
}

const autres = [...trouve.keys()].filter((k) => !ATTENDU.includes(k));
if (autres.length > 0) {
  console.log("\nAutres variables presentes :", autres.join(", "));
}

if (anomalies.length > 0) {
  console.log("\nAnomalies de format :");
  for (const a of anomalies) console.log("  -", a);
}

console.log(
  complet && anomalies.length === 0
    ? "\nConfiguration complete. Lancez : npm run test\n"
    : "\nCorrigez les points ci-dessus, puis relancez : npm run check:env\n",
);
