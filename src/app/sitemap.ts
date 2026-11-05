import type { MetadataRoute } from "next";
import { reglagesSite, siteIndexable } from "@/lib/seo/site";
import { pagesPourPlanDuSite } from "@/lib/seo/pages";

/**
 * Ces pages lisent des réglages en base : sans durée de revalidation, Next les
 * figerait au moment du build et un changement dans la console n'arriverait
 * sur le site qu'au redéploiement suivant. Soixante secondes : la page reste
 * servie en statique, donc rapide, et le réglage arrive dans la minute. Les
 * actions d'administration demandent en plus une revalidation immédiate.
 */
export const revalidate = 60;

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
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!siteIndexable()) return [];

  const [site, pages] = await Promise.all([
    reglagesSite(),
    pagesPourPlanDuSite(),
  ]);
  const maintenant = new Date();

  return pages.map((page) => ({
    url: `${site.canonical}${page.path === "/" ? "" : page.path}`,
    lastModified: maintenant,
    changeFrequency: "weekly" as const,
    priority: page.priority,
  }));
}
