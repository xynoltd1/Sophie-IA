import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import {
  ESPACES_PRIVES,
  PAGES_PUBLIQUES,
  SITE_URL,
  siteIndexable,
} from "./site";

/**
 * État de la configuration de référencement.
 *
 * Ce module lit la configuration réelle du produit. Il ne mesure **pas** les
 * positions dans Google : aucune donnée de classement n'est accessible sans
 * Search Console, et afficher un classement inventé serait pire qu'un écran
 * vide — on prendrait des décisions dessus.
 */

export interface PointSeo {
  titre: string;
  etat: "OK" | "MANQUE" | "ATTENTION";
  detail: string;
}

export function auditSeo(): PointSeo[] {
  const indexable = siteIndexable();

  return [
    {
      titre: "Adresse canonique",
      etat: SITE_URL.startsWith("https://") ? "OK" : "ATTENTION",
      detail: SITE_URL.startsWith("https://")
        ? SITE_URL
        : `${SITE_URL} — une adresse sans HTTPS ne doit pas servir de canonique.`,
    },
    {
      titre: "robots.txt",
      etat: "OK",
      detail: indexable
        ? `Généré, autorise le site et interdit ${ESPACES_PRIVES.length} espaces privés.`
        : "Généré, et interdit tout : cet environnement n’est pas la production.",
    },
    {
      titre: "Plan du site",
      etat: indexable ? "OK" : "ATTENTION",
      detail: indexable
        ? `${PAGES_PUBLIQUES.length} pages publiques déclarées.`
        : "Vide hors production : annoncer les pages d’une préversion revient à demander leur indexation.",
    },
    {
      titre: "Indexation autorisée",
      etat: indexable ? "OK" : "ATTENTION",
      detail: indexable
        ? "NEXT_PUBLIC_APP_ENV vaut production : le site peut être indexé."
        : "NEXT_PUBLIC_APP_ENV ne vaut pas production : tout est en noindex. Normal hors production.",
    },
    {
      titre: "Espaces privés en noindex",
      etat: "OK",
      detail:
        "L’application et la console portent un en-tête noindex, qui vaut même si Google arrive par un lien. robots.txt n’est jamais une protection.",
    },
    {
      titre: "Données structurées",
      etat: "OK",
      detail:
        "Organization, SoftwareApplication et FAQPage sur l’accueil. Ni prix ni note : les déclarer sans les avoir serait trompeur.",
    },
    {
      titre: "Image de partage",
      etat: "MANQUE",
      detail:
        "Aucune image Open Graph dédiée. Un lien partagé sur WhatsApp ou LinkedIn s’affiche sans visuel.",
    },
    {
      titre: "Vérification Search Console",
      etat: process.env.GOOGLE_SITE_VERIFICATION ? "OK" : "MANQUE",
      detail: process.env.GOOGLE_SITE_VERIFICATION
        ? "Le jeton de vérification est présent dans l’environnement."
        : "GOOGLE_SITE_VERIFICATION n’est pas renseignée. Sans elle, la propriété du site n’est pas prouvée à Google.",
    },
  ];
}

export interface TraficSite {
  sessions_humaines: number;
  pages_humaines: number;
  sessions_incertaines: number;
  evenements_robots: number;
  inscriptions: number;
  clics_action: number;
}

export async function traficSite(
  jours: number,
): Promise<{ trafic: TraficSite; vide: boolean }> {
  const supabase = await createServerSupabase();
  const depuis = new Date(Date.now() - jours * 86_400_000).toISOString();

  const { data } = await supabase.rpc("site_traffic", {
    depuis,
    jusqua: new Date().toISOString(),
  });

  const ligne = (Array.isArray(data) ? data[0] : data) as
    TraficSite | undefined;

  const vide =
    !ligne ||
    (ligne.sessions_humaines === 0 &&
      ligne.evenements_robots === 0 &&
      ligne.sessions_incertaines === 0);

  return {
    trafic: ligne ?? {
      sessions_humaines: 0,
      pages_humaines: 0,
      sessions_incertaines: 0,
      evenements_robots: 0,
      inscriptions: 0,
      clics_action: 0,
    },
    vide,
  };
}

export async function sourcesSite(
  jours: number,
): Promise<{ source: string; sessions: number }[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("site_sources", {
    depuis: new Date(Date.now() - jours * 86_400_000).toISOString(),
    limite: 10,
  });
  return (data ?? []) as { source: string; sessions: number }[];
}

export async function pagesSite(
  jours: number,
): Promise<{ chemin: string; vues: number }[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("site_pages", {
    depuis: new Date(Date.now() - jours * 86_400_000).toISOString(),
    limite: 10,
  });
  return (data ?? []) as { chemin: string; vues: number }[];
}

export async function serieSite(
  jours: number,
): Promise<{ jour: string; sessions: number }[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("site_series", { jours });
  return (data ?? []) as { jour: string; sessions: number; pages: number }[];
}
