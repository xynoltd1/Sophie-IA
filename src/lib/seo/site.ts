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

// ---------------------------------------------------------------------------
// Les mêmes valeurs, mais réglables depuis la console
// ---------------------------------------------------------------------------

export interface ReglagesSite {
  name: string;
  title: string;
  description: string;
  canonical: string;
  locale: string;
  og_image: string;
  contact_email: string;
  support_email: string;
}

/** Ce que le code sait faire sans la base. Sert de repli, jamais de vérité. */
export const DEFAUTS_SITE: ReglagesSite = {
  name: SITE_NAME,
  title: "Sophie IA — la secrétaire qui répond pendant que vous travaillez",
  description: SITE_DESCRIPTION,
  canonical: SITE_URL,
  locale: "fr_BE",
  og_image: "",
  contact_email: "",
  support_email: "",
};

/**
 * Les réglages du site, base d'abord.
 *
 * Appelée par `generateMetadata` : ce que la console enregistre arrive donc
 * réellement dans le `<head>` des pages publiques. Un formulaire qui écrirait
 * en base sans que le rendu change serait exactement le genre d'interface
 * décorative qu'on cherche à éviter.
 *
 * Jamais d'exception : base injoignable, la page sort avec les valeurs par
 * défaut plutôt que de ne pas sortir du tout.
 */
export async function reglagesSite(): Promise<ReglagesSite> {
  const { reglages } = await import("@/lib/config/platform");
  const lus = await reglages<Record<string, unknown>>("site", {});

  const texte = (cle: keyof ReglagesSite): string => {
    const valeur = lus[cle];
    return typeof valeur === "string" && valeur.trim().length > 0
      ? valeur.trim()
      : DEFAUTS_SITE[cle];
  };

  return {
    name: texte("name"),
    title: texte("title"),
    description: texte("description"),
    // L'adresse canonique ne doit jamais finir par une barre : deux adresses
    // pour une même page se concurrencent dans l'index.
    canonical: texte("canonical").replace(/\/$/, ""),
    locale: texte("locale"),
    og_image: texte("og_image"),
    contact_email: texte("contact_email"),
    support_email: texte("support_email"),
  };
}
