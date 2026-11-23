/**
 * Audit statique du projet.
 *
 * Il ne cherche pas « des erreurs » en general : il cherche les CLASSES de
 * defaut qui ont reellement casse ce projet, pour que chacune ne puisse plus
 * revenir en silence.
 *
 *   1. une colonne ecrite par le code mais absente des migrations ;
 *   2. une table ecrite avec la session mais sans GRANT ;
 *   3. une table avec RLS et sans politique, ou l inverse ;
 *   4. une action serveur qui leve au lieu de rendre un etat ;
 *   5. un champ texte en defaultValue dans un formulaire d action ;
 *   6. un lien interne vers une route qui n existe pas ;
 *   7. un ecran prive sans garde d authentification.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RACINE = process.cwd();
const constats = [];

function signaler(gravite, categorie, message) {
  constats.push({ gravite, categorie, message });
}

function fichiers(dossier, filtre, acc = []) {
  for (const nom of readdirSync(join(RACINE, dossier))) {
    const chemin = join(dossier, nom);
    if (statSync(join(RACINE, chemin)).isDirectory()) fichiers(chemin, filtre, acc);
    else if (filtre.test(nom)) acc.push(chemin);
  }
  return acc;
}

const lire = (c) => readFileSync(join(RACINE, c), "utf-8");

const SOURCES = fichiers("src", /\.(ts|tsx)$/);
const MIGRATIONS = fichiers("supabase/migrations", /\.sql$/);
const SQL = MIGRATIONS.map(lire).join("\n");

// ---------------------------------------------------------------- 1 et 2
// Les tables touchees par le code, et avec quel client.

const tablesDuCode = new Map(); // nom -> { session, admin, colonnes:Set }

for (const fichier of SOURCES) {
  const source = lire(fichier);
  const utiliseSession = /createServerSupabase/.test(source);
  const utiliseAdmin = /createAdminClient/.test(source);

  for (const m of source.matchAll(/\.from\(\s*["'`]([a-z_]+)["'`]\s*\)/g)) {
    const table = m[1];
    const entree = tablesDuCode.get(table) ?? {
      session: false,
      admin: false,
      fichiers: new Set(),
    };
    entree.session ||= utiliseSession;
    entree.admin ||= utiliseAdmin;
    entree.fichiers.add(fichier);
    tablesDuCode.set(table, entree);
  }
}

for (const [table, info] of tablesDuCode) {
  const definie =
    new RegExp(`create table (if not exists )?public\\.${table}\\b`).test(SQL) ||
    new RegExp(`create (or replace )?view public\\.${table}\\b`).test(SQL);

  if (!definie) {
    signaler(
      "bloquant",
      "schema",
      `table « ${table} » utilisee par le code mais absente des migrations (${[...info.fichiers][0]})`,
    );
    continue;
  }

  if (info.session) {
    const accordee = new RegExp(
      `grant[^;]*on public\\.${table}\\s+to[^;]*authenticated`,
    ).test(SQL);
    if (!accordee) {
      signaler(
        "bloquant",
        "droits",
        `table « ${table} » ecrite avec la session mais sans GRANT : « permission denied » garanti`,
      );
    }
  }
}

// ---------------------------------------------------------------- 3
// RLS sans politique, politique sans RLS.

const avecRls = new Set(
  [...SQL.matchAll(/alter table (?:if exists )?public\.(\w+)\s+enable row level security/g)].map(
    (m) => m[1],
  ),
);
const avecPolitique = new Set(
  [...SQL.matchAll(/on public\.(\w+)\s+for (select|insert|update|delete|all)/g)].map(
    (m) => m[1],
  ),
);

// Les tables volontairement sans politique de lecture, documentees comme telles.
const FERMEES_EXPRES = new Set([
  "provider_credentials",
  "search_console_connection",
  "platform_settings",
  // Journal d audit : ecrit par le service role, lu par personne avec une
  // session utilisateur. Une politique de lecture serait une fuite.
  "audit_logs",
]);

for (const table of avecRls) {
  if (avecPolitique.has(table) || FERMEES_EXPRES.has(table)) continue;
  signaler(
    "attention",
    "isolation",
    `table « ${table} » a RLS active sans aucune politique : elle est fermee a tout le monde`,
  );
}

for (const table of avecPolitique) {
  if (avecRls.has(table)) continue;
  signaler(
    "bloquant",
    "isolation",
    `table « ${table} » a des politiques mais RLS n est pas active : les politiques ne s appliquent pas`,
  );
}

// ---------------------------------------------------------------- 4
// Une action serveur qui leve au lieu de rendre un etat.

for (const fichier of SOURCES.filter((f) => /actions\.ts$/.test(f))) {
  const source = lire(fichier);
  if (!/^"use server";/m.test(source)) continue;

  for (const m of source.matchAll(/throw new Error\(/g)) {
    const ligne = source.slice(0, m.index).split("\n").length;
    signaler(
      "attention",
      "erreurs",
      `${fichier}:${ligne} leve une exception : l ecran affichera « Application error », pas le message`,
    );
  }
}

// ---------------------------------------------------------------- 5
// Un champ texte pre-rempli dans un formulaire d action serveur.

for (const fichier of SOURCES.filter((f) => /\.tsx$/.test(f))) {
  const source = lire(fichier);
  if (!/useActionState/.test(source)) continue;

  for (const m of source.matchAll(/defaultValue=\{([a-zA-Z][\w.?\s]*)\}/g)) {
    const valeur = m[1].trim();
    // Un nombre ou un booleen se reinitialise sans consequence visible.
    if (/^\d+$/.test(valeur)) continue;
    // Un champ qui enregistre a la volee (onBlur, onChange) n attend pas la
    // soumission du formulaire : son contenu ne se perd pas.
    const alentour = source.slice(m.index, m.index + 400);
    if (/onBlur=|onChange=/.test(alentour.split("/>")[0] ?? "")) continue;
    const ligne = source.slice(0, m.index).split("\n").length;
    signaler(
      "attention",
      "formulaires",
      `${fichier}:${ligne} defaultValue={${valeur}} : React vide ce champ apres chaque echec`,
    );
  }
}

// ---------------------------------------------------------------- 6
// Les liens internes qui ne menent nulle part.

const routes = new Set(["/"]);
for (const fichier of SOURCES.filter((f) => /\/page\.tsx$/.test(f))) {
  let chemin = fichier
    .replace(/^src\/app/, "")
    .replace(/\/page\.tsx$/, "")
    .replace(/\/\([^)]+\)/g, "");
  routes.add(chemin === "" ? "/" : chemin);
}

const dynamiques = [...routes].filter((r) => r.includes("["));
const statiques = new Set([...routes].filter((r) => !r.includes("[")));

for (const fichier of SOURCES) {
  const source = lire(fichier);
  for (const m of source.matchAll(/href="(\/[^"#?]*)"/g)) {
    const lien = m[1].replace(/\/$/, "") || "/";
    if (statiques.has(lien)) continue;
    if (lien.startsWith("/api/")) continue;

    const correspond = dynamiques.some((modele) => {
      const motif = new RegExp(
        "^" + modele.replace(/\[[^\]]+\]/g, "[^/]+") + "$",
      );
      return motif.test(lien);
    });
    if (correspond) continue;

    const ligne = source.slice(0, m.index).split("\n").length;
    signaler("bloquant", "navigation", `${fichier}:${ligne} lien mort vers ${lien}`);
  }
}

// ---------------------------------------------------------------- 7
// Un ecran prive sans garde.

for (const fichier of SOURCES.filter((f) => /\/page\.tsx$/.test(f))) {
  const source = lire(fichier);
  const prive = /src\/app\/\(app\)|src\/app\/admin|src\/app\/onboarding/.test(fichier);
  if (!prive) continue;

  const garde =
    /requireOrganization|requirePlatformAdmin|requireUser|requireOnboarding|requireStep|requireSession/.test(
      source,
    );
  if (!garde) {
    signaler("bloquant", "securite", `${fichier} : ecran prive sans garde d authentification`);
  }
}

// ---------------------------------------------------------------- 8
// Une colonne demandee par le code mais absente des migrations.
//
// C est le defaut qui a fait repondre « cette page n existe pas » sur un devis
// qui existait : la requete demandait contacts(display_name), une colonne que
// la table n a jamais eue. PostgREST repond 42703, le code rendait null, et
// l ecran traduisait ce null en 404. Les tests ne le voyaient pas parce qu ils
// ne parlent jamais a PostgreSQL. Celui-ci compare les deux textes.

const COLONNES = new Map();

for (const fichier of MIGRATIONS) {
  const sql = lire(fichier);

  for (const bloc of sql.matchAll(
    /create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/g,
  )) {
    const [, table, corps] = bloc;
    const colonnes = COLONNES.get(table) ?? new Set();
    for (const ligne of corps.split("\n")) {
      const m = ligne.match(/^\s{2}(\w+)\s+\S/);
      if (m && !/^(constraint|primary|unique|check|foreign|exclude)$/i.test(m[1])) {
        colonnes.add(m[1]);
      }
    }
    COLONNES.set(table, colonnes);
  }

  for (const ajout of sql.matchAll(
    /alter table (?:only )?public\.(\w+)([\s\S]*?);/g,
  )) {
    const [, table, corps] = ajout;
    const colonnes = COLONNES.get(table) ?? new Set();
    for (const m of corps.matchAll(/add column (?:if not exists )?(\w+)/g)) {
      colonnes.add(m[1]);
    }
    for (const m of corps.matchAll(/rename column (\w+) to (\w+)/g)) {
      colonnes.delete(m[1]);
      colonnes.add(m[2]);
    }
    for (const m of corps.matchAll(/drop column (?:if exists )?(\w+)/g)) {
      colonnes.delete(m[1]);
    }
    if (colonnes.size) COLONNES.set(table, colonnes);
  }
}

// Les embeds PostgREST nomment la table liee : « contacts(id, full_name) ».
// On ne verifie que ceux-la : leur table est ecrite dans la chaine meme, sans
// avoir a deviner quel .from() les precede. On parcourt toutes les chaines du
// fichier, pas seulement celles passees a .select() : la liste de colonnes est
// souvent rangee dans une constante, et c est precisement la que se cachait la
// colonne inventee.

const CHAINES = /`[^`\\]*`|"[^"\n]*"|'[^'\n]*'/g;
const EMBED = /(\w+)\s*\(\s*([\w\s,:!*.]+?)\s*\)/g;

for (const fichier of SOURCES) {
  const source = lire(fichier);

  for (const litteral of source.match(CHAINES) ?? []) {
    const chaine = litteral.slice(1, -1);
    if (!chaine.includes("(") || !chaine.includes(",")) continue;

    for (const embed of chaine.matchAll(EMBED)) {
      const table = embed[1].replace(/^.*[:!]/, "");
      const connues = COLONNES.get(table);
      if (!connues) continue;

      for (const brute of embed[2].split(",")) {
        const colonne = brute.trim().replace(/^.*[:!]/, "").split(/[\s(]/)[0];
        if (!colonne || colonne === "*") continue;
        if (!connues.has(colonne)) {
          signaler(
            "bloquant",
            "base",
            `${fichier} : la requete demande ${table}.${colonne}, absente des migrations`,
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------------- bilan

const ordre = { bloquant: 0, attention: 1 };
constats.sort(
  (a, b) => ordre[a.gravite] - ordre[b.gravite] || a.categorie.localeCompare(b.categorie),
);

if (constats.length === 0) {
  console.log("AUDIT : aucun constat.");
} else {
  for (const c of constats) {
    console.log(`[${c.gravite.toUpperCase()}] ${c.categorie} — ${c.message}`);
  }
  console.log(
    `\n${constats.length} constats : ` +
      `${constats.filter((c) => c.gravite === "bloquant").length} bloquants, ` +
      `${constats.filter((c) => c.gravite === "attention").length} a regarder.`,
  );
}

process.exit(constats.some((c) => c.gravite === "bloquant") ? 1 : 0);
