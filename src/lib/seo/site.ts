/**
 * Les constantes du site public.
 *
 * Une seule source pour l'adresse canonique : un titre, une adresse de
 * partage et un plan du site qui ne s'accordent pas, c'est le genre d'erreur
 * qui ne se voit jamais en relisant le code et toujours dans Search Console,
 * trois semaines plus tard.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://zelicall.com"
).replace(/\/$/, "");

export const SITE_NAME = "Sophie IA";

export const SITE_DESCRIPTION =
  "Sophie répond au téléphone pendant que vous travaillez : elle comprend la demande, " +
  "consulte votre agenda, propose un rendez-vous et vous transmet tout, résumé.";

/**
 * Les pages que les moteurs ont le droit d'indexer.
 *
 * Liste explicite, et non parcours automatique des fichiers. Un plan du site
 * qui se construit tout seul finit par annoncer une page privée le jour où
 * quelqu'un ajoute un dossier — et un plan du site est exactement l'endroit
 * où un moteur va chercher ce qu'il ne connaît pas encore.
 */
export const PAGES_PUBLIQUES = [
  { chemin: "/", priorite: 1, frequence: "weekly" as const },
  { chemin: "/signup", priorite: 0.6, frequence: "monthly" as const },
] as const;

/** Les espaces qui ne doivent jamais être parcourus ni indexés. */
export const ESPACES_PRIVES = [
  "/app",
  "/admin",
  "/api",
  "/onboarding",
  "/auth",
  "/rdv",
  "/invitation",
  "/nouveau-mot-de-passe",
] as const;

/**
 * Le site est-il indexable ?
 *
 * Une préversion indexée ferait concurrence au vrai site sur ses propres mots,
 * et Google choisirait lui-même laquelle des deux montrer. C'est l'erreur de
 * référencement la plus courante et la plus coûteuse à rattraper.
 */
export function siteIndexable(): boolean {
  return (process.env.NEXT_PUBLIC_APP_ENV ?? "development") === "production";
}
