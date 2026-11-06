import type { Metadata } from "next";
import { reglagesSite } from "./site";
import { pageSeo } from "./pages";

/**
 * Les métadonnées d'une page légale.
 *
 * ## Pourquoi elles ne sont jamais indexables ici
 *
 * Ces pages sont des brouillons. Une politique de confidentialité ou des
 * conditions de vente trouvées par un moteur de recherche sont lues comme le
 * document en vigueur, et un client pourrait raisonnablement s'en prévaloir.
 * Tant qu'un juriste ne les a pas relues, elles restent accessibles — le pied
 * de page y mène, et c'est nécessaire — mais hors des résultats de recherche
 * et hors du plan du site.
 *
 * Le jour où elles sont validées, il suffit de les passer « indexables » dans
 * la console : le réglage par page existe depuis la 0.19.0, et il l'emporte
 * ici comme ailleurs.
 */
export async function metadonneesLegales(
  chemin: string,
  titre: string,
): Promise<Metadata> {
  const [site, page] = await Promise.all([reglagesSite(), pageSeo(chemin)]);

  const indexable = page?.indexable === true;

  return {
    title: `${titre} — ${site.name}`,
    description:
      page?.description?.trim() ||
      `${titre} de ${site.name}. Document de travail, non validé juridiquement.`,
    alternates: { canonical: `${site.canonical}${chemin}` },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}
