import type { MetadataRoute } from "next";
import { PAGES_PUBLIQUES, SITE_URL, siteIndexable } from "@/lib/seo/site";

/**
 * Plan du site.
 *
 * Il ne contient que des pages publiques, canoniques et indexables, et la
 * liste est écrite à la main dans `lib/seo/site.ts`. Un plan qui se
 * construirait en parcourant les dossiers finirait par annoncer une page
 * privée le jour où quelqu'un en ajoute une — et le plan du site est
 * précisément l'endroit où un moteur va chercher ce qu'il ne connaît pas.
 *
 * Hors production, il est vide : annoncer les pages d'une préversion revient à
 * demander leur indexation.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteIndexable()) return [];

  const maintenant = new Date();

  return PAGES_PUBLIQUES.map((page) => ({
    url: `${SITE_URL}${page.chemin === "/" ? "" : page.chemin}`,
    lastModified: maintenant,
    changeFrequency: page.frequence,
    priority: page.priorite,
  }));
}
