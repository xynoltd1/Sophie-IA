import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const RACINE = process.cwd();
const MIGRATION = readFileSync(
  resolve(RACINE, "supabase/migrations/20261102120000_0027_platform_admin.sql"),
  "utf-8",
);

/**
 * L espace plateforme peut modifier ce que Sophie dira aux clients de TOUTES
 * les entreprises. Les tests ci-dessous protegent les deux proprietes qui
 * rendent cet espace acceptable : une autorisation separee de celle des
 * entreprises, et aucun acces aux enregistrements audio.
 */
describe("separation des deux autorisations", () => {
  it("l espace plateforme ne s appuie jamais sur l appartenance a une organisation", () => {
    const garde = readFileSync(resolve(RACINE, "src/lib/auth/platform.ts"), "utf-8");
    expect(garde).toContain("is_platform_admin");
    expect(garde).not.toContain("is_org_member");
  });

  it("chaque page de l espace plateforme passe la garde", () => {
    const pages = readdirSync(resolve(RACINE, "src/app/admin"), { withFileTypes: true });
    const fichiers: string[] = ["src/app/admin/page.tsx", "src/app/admin/layout.tsx"];
    for (const entree of pages) {
      if (entree.isDirectory()) fichiers.push(`src/app/admin/${entree.name}/page.tsx`);
    }

    for (const fichier of fichiers) {
      const contenu = readFileSync(resolve(RACINE, fichier), "utf-8");
      expect(contenu, `${fichier} n appelle pas la garde`).toContain("requirePlatformAdmin");
    }
  });

  it("les ecritures de la plateforme sont reservees en base, pas seulement dans le code", () => {
    // La garde applicative cache l ecran. Seule la policy empeche l ecriture.
    for (const policy of [
      '"plans: administration plateforme"',
      '"abonnements: administration plateforme"',
      '"metiers: administration plateforme"',
    ]) {
      expect(MIGRATION, `${policy} manque`).toContain(policy);
    }
    expect(MIGRATION).toContain("public.is_platform_admin()");
  });
});

describe("aucun acces aux enregistrements depuis la plateforme", () => {
  it("la migration ne touche jamais a l audio", () => {
    // Section 37, explicitement : le super administrateur n a pas un acces
    // libre et non audite aux audios des clients.
    //
    // Les commentaires sont retires avant le controle : la migration PARLE de
    // cette interdiction, et c est tres bien. Ce qui compterait serait qu elle
    // l enfreigne dans du SQL execute.
    const execute = MIGRATION.split("\n")
      .filter((ligne) => !ligne.trim().startsWith("--"))
      .join("\n");

    expect(execute).not.toContain("recording_path");
    expect(execute).not.toContain("call-recordings");
  });

  it("aucune page de la plateforme ne lit un enregistrement", () => {
    const dossier = resolve(RACINE, "src/app/admin");
    const aLire: string[] = [];
    const parcours = (chemin: string) => {
      for (const entree of readdirSync(chemin, { withFileTypes: true })) {
        const complet = `${chemin}/${entree.name}`;
        if (entree.isDirectory()) parcours(complet);
        else if (entree.name.endsWith(".tsx") || entree.name.endsWith(".ts")) aLire.push(complet);
      }
    };
    parcours(dossier);

    for (const fichier of aLire) {
      const contenu = readFileSync(fichier, "utf-8");
      expect(contenu, `${fichier} touche a l audio`).not.toContain("recording_path");
      expect(contenu, `${fichier} touche au bucket audio`).not.toContain("call-recordings");
    }
  });
});

describe("facturation", () => {
  it("un prix non fixe reste nul, jamais zero", () => {
    // Zero voudrait dire « gratuit ». Le cahier des charges interdit
    // d inventer un tarif (section 38).
    expect(MIGRATION).toContain("monthly_price_cents is null or monthly_price_cents >= 0");
    const insertion = MIGRATION.slice(MIGRATION.indexOf("insert into public.plans"));
    expect(insertion).not.toMatch(/monthly_price_cents/);
  });

  it("une entreprise ne peut pas avoir deux abonnements vivants", () => {
    expect(MIGRATION).toMatch(/create unique index[\s\S]*subscriptions_active_idx/);
  });

  it("une consommation n est comptee qu une fois", () => {
    // Les webhooks sont rejoues : sans cette cle, on facturerait deux fois.
    expect(MIGRATION).toMatch(/create unique index[\s\S]*usage_records_dedupe_idx/);
  });

  it("les minutes se comptent en fractions", () => {
    expect(MIGRATION).toContain("numeric(12, 3)");
  });
});

describe("journal des actions d administration", () => {
  it("chaque ecriture de la plateforme est journalisee", () => {
    for (const fichier of ["src/app/admin/metiers/actions.ts", "src/app/admin/plans/actions.ts"]) {
      const contenu = readFileSync(resolve(RACINE, fichier), "utf-8");
      expect(contenu, `${fichier} n est pas journalise`).toContain("journaliserAdmin");
    }
  });

  it("le journal de securite n est pas melange au fil d activite du tenant", () => {
    const audit = readFileSync(resolve(RACINE, "src/lib/platform/audit.ts"), "utf-8");
    expect(audit).toContain("audit_logs");
    expect(audit).not.toContain('from("activities")');
  });
});
