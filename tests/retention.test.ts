import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  RETENTION_FIELDS,
  clampRetention,
  dureeLisible,
} from "../src/lib/org/retention";

const RACINE = process.cwd();
const MIGRATIONS = resolve(RACINE, "supabase/migrations");

function sql(): string {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(resolve(MIGRATIONS, f), "utf-8"))
    .join("\n");
}

function sources(dossier = "src"): string[] {
  const base = resolve(RACINE, dossier);
  const resultats: string[] = [];
  for (const entree of readdirSync(base, { withFileTypes: true })) {
    const chemin = `${dossier}/${entree.name}`;
    if (entree.isDirectory()) resultats.push(...sources(chemin));
    else if (/\.tsx?$/.test(entree.name)) resultats.push(chemin);
  }
  return resultats;
}

describe("durees de conservation", () => {
  it("borne les valeurs aberrantes", () => {
    expect(clampRetention(0)).toBe(MIN_RETENTION_DAYS);
    expect(clampRetention(-50)).toBe(MIN_RETENTION_DAYS);
    expect(clampRetention(99_999)).toBe(MAX_RETENTION_DAYS);
    expect(clampRetention(Number.NaN)).toBe(365);
    expect(clampRetention(90.4)).toBe(90);
  });

  it("dit la duree en mots verifiables", () => {
    expect(dureeLisible(30)).toBe("un mois");
    expect(dureeLisible(90)).toBe("3 mois");
    expect(dureeLisible(365)).toBe("un an");
    expect(dureeLisible(1095)).toBe("3 ans");
    expect(dureeLisible(45)).toBe("45 jours");
  });

  it("decrit les trois durees reglables", () => {
    expect(RETENTION_FIELDS).toHaveLength(3);
    for (const champ of RETENTION_FIELDS) {
      expect(champ.titre.length).toBeGreaterThan(0);
      expect(champ.detail.length).toBeGreaterThan(20);
    }
  });
});

describe("purges en base", () => {
  const contenu = sql();

  it("borne les durees en base, pas seulement dans l interface", () => {
    // Un appel direct a l API REST contourne le formulaire. La contrainte est
    // la seule chose qu il ne peut pas contourner.
    expect(contenu).toContain("transcript_retention_days between 30 and 1825");
    expect(contenu).toContain("summary_retention_days between 30 and 1825");
    expect(contenu).toContain("message_retention_days between 30 and 1825");
  });

  it("respecte la duree propre a chaque entreprise", () => {
    // Le piege serait d ecrire une constante : une entreprise qui a choisi 90
    // jours subirait le defaut d une autre.
    for (const colonne of [
      "transcript_retention_days",
      "summary_retention_days",
      "message_retention_days",
    ]) {
      expect(contenu, `${colonne} n est pas lue par sa purge`).toContain(
        `make_interval(days => o.${colonne})`,
      );
    }
  });

  it("retire aux utilisateurs connectes le droit de vider une table", () => {
    // Trouve sur la vraie base le 2026-11-03 : `authenticated` avait TRUNCATE
    // sur les trente-quatre tables de public, herite d un privilege par defaut
    // de Supabase. TRUNCATE ignore RLS. La migration doit traiter les tables
    // existantes ET les futures, sinon la prochaine migration recree le trou.
    expect(contenu).toContain("revoke truncate, references, trigger on public.%I");
    // Les vues aussi : `pg_tables` ne les contient pas, et la premiere
    // migration les avait manquees (0032).
    expect(contenu).toContain("c.relkind in ('v', 'm', 'f', 'p')");
    expect(contenu).toContain(
      "alter default privileges in schema public\n  revoke truncate, references, trigger on tables from anon, authenticated",
    );
  });

  it("reserve le journal des purges a la plateforme", () => {
    const bloc = contenu.slice(
      contenu.indexOf("create table if not exists public.retention_runs"),
    );
    const policy = bloc.slice(
      bloc.indexOf("on public.retention_runs for select"),
      bloc.indexOf("grant select on public.retention_runs"),
    );
    expect(policy).toContain("is_platform_admin()");
    // Aucune ecriture depuis le client : seul le serveur consigne.
    expect(bloc.slice(0, 2000)).not.toContain(
      "grant insert on public.retention_runs",
    );
  });

  it("expose chaque fonction appelee par le code", () => {
    // Un rpc() qui ne correspond a aucune fonction echoue en production et
    // nulle part ailleurs : le typecheck ne le voit pas.
    const appels = new Set<string>();
    for (const fichier of sources()) {
      const texte = readFileSync(resolve(RACINE, fichier), "utf-8");
      for (const trouve of texte.matchAll(/\.rpc\(\s*"([a-z0-9_]+)"/g)) {
        if (trouve[1]) appels.add(trouve[1]);
      }
    }

    expect(appels.size).toBeGreaterThan(5);
    for (const nom of appels) {
      expect(
        contenu,
        `la fonction ${nom} n existe dans aucune migration`,
      ).toContain(`function public.${nom}(`);
    }
  });
});

describe("tache de purge", () => {
  const job = readFileSync(
    resolve(RACINE, "src/lib/jobs/retention.ts"),
    "utf-8",
  );

  it("consigne les six genres", () => {
    for (const genre of [
      "AUDIO",
      "CALL_TRASH",
      "TRANSCRIPT",
      "SUMMARY",
      "CALL_EVENT",
      "MESSAGE",
    ]) {
      expect(job, `le genre ${genre} n est pas execute`).toContain(
        `executer("${genre}"`,
      );
    }
  });

  it("isole chaque purge des autres", () => {
    // Sans try/catch par purge, la premiere en echec emporte les cinq autres.
    expect(job).toContain("catch (cause)");
    expect(job).toContain("record_retention_run");
  });

  it("supprime les fichiers avant les lignes qui les designent", () => {
    // L ordre inverse laisse des objets que plus rien ne reference, donc que
    // plus rien ne supprimera jamais.
    const bloc = job.slice(job.indexOf('executer("CALL_TRASH"'));
    const fichiers = bloc.indexOf(".remove(");
    const lignes = bloc.indexOf(".delete()");
    expect(fichiers).toBeGreaterThan(-1);
    expect(lignes).toBeGreaterThan(fichiers);
  });

  it("n est pas appelable sans le secret de la tache", () => {
    const route = readFileSync(
      resolve(RACINE, "src/app/api/jobs/post-call/route.ts"),
      "utf-8",
    );
    expect(route).toContain("jobAutorise");
    expect(route).toContain("executerPurges");
  });
});

describe("ecran des taches", () => {
  const RACINE_SRC = resolve(RACINE, "src");

  it("l accueil renvoie vers un ecran qui connait le filtre annonce", () => {
    // L accueil annoncait « 3 taches en retard » et renvoyait vers un filtre de
    // prospects qui ignorait ce mot : le compte etait juste, le lien ne menait
    // nulle part.
    const accueil = readFileSync(
      resolve(RACINE_SRC, "app/(app)/app/page.tsx"),
      "utf-8",
    );
    expect(accueil).toContain("/app/taches?vue=retard");
    expect(accueil).not.toContain("prospects?filtre=retard");

    const page = readFileSync(
      resolve(RACINE_SRC, "app/(app)/app/taches/page.tsx"),
      "utf-8",
    );
    expect(page).toContain("estVue");
  });

  it("la bascule d une tache verifie l organisation", () => {
    // Sans ce filtre, un identifiant devine permettrait de cocher la tache
    // d une autre entreprise.
    const actions = readFileSync(
      resolve(RACINE_SRC, "app/(app)/app/taches/actions.ts"),
      "utf-8",
    );
    const bloc = actions.slice(
      actions.indexOf("export async function basculerTache"),
    );
    expect(bloc).toContain('.eq("organization_id"');
  });

  it("n ecrit pas completed_at a la main", () => {
    // Un declencheur en base le pose et le retire (migration 0013). Deux
    // endroits qui ecrivent la meme date finissent par la contredire.
    const actions = readFileSync(
      resolve(RACINE_SRC, "app/(app)/app/taches/actions.ts"),
      "utf-8",
    );
    expect(actions).not.toContain("completed_at:");
  });

  it("pose l echeance en fin de journee locale", () => {
    // A minuit UTC, une tache due jeudi devient « en retard » le jeudi a une
    // heure du matin, pendant la journee meme ou elle doit etre faite.
    const actions = readFileSync(
      resolve(RACINE_SRC, "app/(app)/app/taches/actions.ts"),
      "utf-8",
    );
    expect(actions).toContain("instantDepuisHeureLocale");
    expect(actions).toContain('"23:59"');
  });
});
