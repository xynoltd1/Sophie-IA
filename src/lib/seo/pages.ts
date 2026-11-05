import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ESPACES_PRIVES, PAGES_PUBLIQUES } from "./site";

/**
 * Le référencement page par page.
 *
 * ## Deux sources, et laquelle gagne
 *
 * Les pages publiques sont déclarées dans le code (`PAGES_PUBLIQUES`) : c'est
 * la liste de ce qui existe réellement. La base ne peut qu'**ajuster** ce qui
 * existe — titre, description, indexation, présence dans le plan du site.
 *
 * Elle ne peut pas inventer une page. Une entrée en base pour un chemin que
 * l'application ne sert pas produirait une adresse annoncée à Google et
 * répondant 404 : le genre d'erreur qui met des semaines à se voir et des
 * semaines à se réparer.
 *
 * ## Le garde-fou est double
 *
 * Une contrainte en base refuse déjà tout chemin commençant par `/app`,
 * `/admin` ou les autres espaces privés. Ce module vérifie en plus que le
 * chemin figure dans la liste du code. Deux verrous, parce que le plan du site
 * est exactement l'endroit où un moteur va chercher ce qu'il ne connaît pas.
 */

export interface PageSeo {
  path: string;
  title: string | null;
  description: string | null;
  og_image: string | null;
  indexable: boolean;
  in_sitemap: boolean;
  published: boolean;
  priority: number;
  /** Nul quand la page n'a jamais été réglée depuis la console. */
  updated_at: string | null;
}

function cheminAutorise(chemin: string): boolean {
  if (!chemin.startsWith("/")) return false;
  if (ESPACES_PRIVES.some((p) => chemin === p || chemin.startsWith(`${p}/`)))
    return false;
  return PAGES_PUBLIQUES.some((p) => p.chemin === chemin);
}

/** Toutes les pages connues, réglages de la base compris. Pour l'écran d'administration. */
export async function pagesSeo(): Promise<PageSeo[]> {
  const parDefaut: PageSeo[] = PAGES_PUBLIQUES.map((p) => ({
    path: p.chemin,
    title: null,
    description: null,
    og_image: null,
    indexable: true,
    in_sitemap: true,
    published: true,
    priority: p.priorite,
    updated_at: null,
  }));

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("seo_pages")
      .select(
        "path, title, description, og_image, indexable, in_sitemap, published, priority, updated_at",
      );

    const enBase = new Map(
      ((data ?? []) as PageSeo[]).map((ligne) => [
        ligne.path,
        { ...ligne, priority: Number(ligne.priority) },
      ]),
    );

    return parDefaut.map((page) => enBase.get(page.path) ?? page);
  } catch {
    return parDefaut;
  }
}

/** Les réglages d'une page, pour son `generateMetadata`. */
export async function pageSeo(chemin: string): Promise<PageSeo | null> {
  if (!cheminAutorise(chemin)) return null;
  const toutes = await pagesSeo();
  return toutes.find((p) => p.path === chemin) ?? null;
}

/**
 * Les pages à mettre dans le plan du site.
 *
 * Quatre conditions, toutes nécessaires : la page existe dans le code, elle
 * est publiée, elle est marquée pour le plan, et elle est indexable. Annoncer
 * une page qu'on demande par ailleurs de ne pas indexer est une contradiction
 * que Google signale.
 */
export async function pagesPourPlanDuSite(): Promise<PageSeo[]> {
  const toutes = await pagesSeo();
  return toutes.filter(
    (page) =>
      cheminAutorise(page.path) &&
      page.published &&
      page.in_sitemap &&
      page.indexable,
  );
}

export { cheminAutorise };
