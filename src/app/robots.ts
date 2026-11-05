import type { MetadataRoute } from "next";
import { ESPACES_PRIVES, reglagesSite, siteIndexable } from "@/lib/seo/site";

/**
 * `robots.txt`, généré plutôt qu'écrit à la main.
 *
 * ## Ce que ce fichier n'est pas
 *
 * Ce n'est **pas** une protection. Une adresse listée en `Disallow` reste
 * accessible à qui la connaît, et le fichier la publie à la vue de tous —
 * c'est même le premier endroit qu'un visiteur curieux va lire. La protection
 * de `/app` et `/admin` vient de l'authentification et de RLS ; ces règles ne
 * servent qu'à éviter que Google perde son temps et indexe des pages de
 * connexion.
 *
 * ## Pourquoi la préversion est interdite
 *
 * Une préversion indexée fait concurrence au vrai site sur ses propres mots,
 * et c'est Google qui choisit laquelle montrer. L'erreur est courante et longue
 * à rattraper.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!siteIndexable()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  const site = await reglagesSite();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ESPACES_PRIVES.map((espace) => `${espace}/`),
      },
    ],
    sitemap: `${site.canonical}/sitemap.xml`,
    host: site.canonical,
  };
}
