import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FILTRES, PERIODES, bornesAffichees, debutPeriode } from "@/lib/crm/calls-query";

const RACINE = process.cwd();
const MIGRATION = readFileSync(
  resolve(RACINE, "supabase/migrations/20261102140000_0029_calls_management.sql"),
  "utf-8",
);

/**
 * La liste des appels est l ecran le plus consulte apres l accueil. Trois
 * choses doivent y rester vraies : le total affiche est juste, l ordre ne
 * change pas entre deux pages, et une suppression n emporte jamais plus que
 * l appel.
 */
describe("pagination", () => {
  it("annonce les bonnes bornes", () => {
    const page = {
      appels: new Array(10).fill(null).map((_, i) => ({ id: String(i) })),
      total: 147,
      page: 1,
      taille: 10,
      pages: 15,
      erreur: false,
    } as never;

    expect(bornesAffichees(page)).toEqual({ debut: 1, fin: 10 });
  });

  it("annonce les bonnes bornes sur la derniere page", () => {
    const page = {
      appels: new Array(7).fill(null).map((_, i) => ({ id: String(i) })),
      total: 147,
      page: 15,
      taille: 10,
      pages: 15,
      erreur: false,
    } as never;

    expect(bornesAffichees(page)).toEqual({ debut: 141, fin: 147 });
  });

  it("n annonce rien quand il n y a rien", () => {
    const page = { appels: [], total: 0, page: 1, taille: 10, pages: 0, erreur: false } as never;
    expect(bornesAffichees(page)).toEqual({ debut: 0, fin: 0 });
  });

  it("garde un ordre deterministe", () => {
    // Sans second critere de tri, deux appels a la meme seconde peuvent
    // changer de place entre la page 1 et la page 2 : une ligne se repete,
    // une autre disparait.
    expect(MIGRATION).toContain("order by f.started_at desc, f.id desc");
  });

  it("compte le total avant de decouper", () => {
    // Un total calcule sur la page affichee vaudrait toujours la taille de la
    // page. Le comptage se fait sur l ensemble filtre.
    const fonction = MIGRATION.slice(MIGRATION.indexOf("function public.search_calls"));
    expect(fonction).toContain("compte as (select count(*) as total from filtre)");
  });

  it("borne la taille de page demandee", () => {
    // Sans borne, une adresse forgee pourrait demander dix mille lignes.
    expect(MIGRATION).toContain("least(coalesce(taille, 20), 50)");
  });
});

describe("periodes", () => {
  it("calcule le debut de chaque periode", () => {
    const maintenant = new Date("2026-11-02T15:00:00Z");
    expect(debutPeriode("TOUT", maintenant)).toBeNull();
    expect(debutPeriode("7J", maintenant)).toBe("2026-10-26T15:00:00.000Z");
    expect(debutPeriode("30J", maintenant)).toBe("2026-10-03T15:00:00.000Z");
  });

  it("propose des filtres et des periodes nommes", () => {
    expect(FILTRES.map((f) => f.cle)).toContain("SANS_SUITE");
    expect(PERIODES.map((p) => p.cle)).toContain("AUJOURD_HUI");
  });
});

describe("suppression d un appel", () => {
  it("est une corbeille, pas un effacement", () => {
    expect(MIGRATION).toContain("deleted_at timestamptz");
    expect(MIGRATION).toContain("function public.trash_calls");
    expect(MIGRATION).toContain("function public.restore_calls");
  });

  it("est reservee aux responsables, en base", () => {
    // Le controle dans l interface cache le bouton ; seul celui-ci protege.
    const fonction = MIGRATION.slice(
      MIGRATION.indexOf("function public.trash_calls"),
      MIGRATION.indexOf("function public.restore_calls"),
    );
    expect(fonction).toContain("has_org_role(org_id, array['OWNER','ADMIN']");
  });

  it("n emporte ni rendez-vous, ni contact, ni demande", () => {
    // Supprimer la trace d un appel ne doit jamais faire disparaitre un
    // rendez-vous confirme ni un client.
    const fonction = MIGRATION.slice(
      MIGRATION.indexOf("function public.trash_calls"),
      MIGRATION.indexOf("function public.restore_calls"),
    );
    for (const table of ["appointments", "contacts", "leads", "tasks"]) {
      expect(fonction, `trash_calls touche a ${table}`).not.toContain(`from public.${table}`);
      expect(fonction, `trash_calls supprime dans ${table}`).not.toContain(`delete from public.${table}`);
    }
  });

  it("est journalisee", () => {
    expect(MIGRATION).toContain("'CALLS_TRASHED'");
    expect(MIGRATION).toContain("'CALLS_RESTORED'");
  });

  it("supprime le fichier audio avant la ligne", () => {
    // Dans l ordre inverse, le fichier deviendrait orphelin : plus rien ne le
    // reference, donc plus rien ne le supprimera jamais.
    const job = readFileSync(resolve(RACINE, "src/app/api/jobs/post-call/route.ts"), "utf-8");
    const bloc = job.slice(job.indexOf("calls_to_purge"));
    expect(bloc.indexOf(".remove(fichiers)")).toBeLessThan(bloc.indexOf('.from("calls")\n        .delete()'));
  });

  it("l action verifie aussi le role avant d appeler la base", () => {
    const actions = readFileSync(
      resolve(RACINE, "src/app/(app)/app/appels/actions.ts"),
      "utf-8",
    );
    expect(actions).toContain('can(activeOrganization.role, "organization:update")');
    expect(actions).toContain("ids.length > 100");
  });
});

describe("la corbeille ne fausse pas les compteurs", () => {
  it("l accueil ignore les appels supprimes", () => {
    const fonction = MIGRATION.slice(MIGRATION.indexOf("function public.dashboard_counts"));
    expect(fonction).toContain("c.deleted_at is null");
  });
});

describe("relation membre vers profil", () => {
  it("la cle etrangere manquante est creee", () => {
    // Sans elle, PostgREST ne peut pas deduire la relation et
    // `select(..., profiles(full_name))` echoue : c est la cause de
    // « la liste de l equipe n a pas pu etre chargee ».
    expect(MIGRATION).toContain("organization_members_profile_fkey");
    expect(MIGRATION).toContain("references public.profiles (id)");
  });

  it("les profils manquants sont crees avant la contrainte", () => {
    // Un membre sans profil ferait echouer la contrainte sur une base
    // existante. On repare les donnees d abord.
    const insertion = MIGRATION.indexOf("insert into public.profiles (id)");
    const contrainte = MIGRATION.indexOf("organization_members_profile_fkey");
    expect(insertion).toBeGreaterThan(-1);
    expect(insertion).toBeLessThan(contrainte);
  });
});
