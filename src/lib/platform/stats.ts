import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Lecture des statistiques de la plateforme.
 *
 * Tout est calculé en base (migration 0033) : compter côté application
 * obligerait à rapatrier des milliers de lignes pour en faire une somme, et
 * la somme serait fausse dès que la pagination s'en mêlerait.
 *
 * Chaque fonction renvoie une valeur utilisable même en cas d'échec. Un écran
 * de pilotage qui tombe en entier parce qu'un compteur manque est moins utile
 * qu'un écran qui affiche les autres.
 */

export interface StatsPlateforme {
  organizations_total: number;
  organizations_new: number;
  organizations_activated: number;
  subscriptions_active: number;
  calls_total: number;
  calls_completed: number;
  calls_failed: number;
  calls_duration_seconds: number;
  appointments_created: number;
  appointments_confirmed: number;
  leads_created: number;
  tasks_created: number;
  urgent_leads: number;
  messages_sent: number;
  messages_failed: number;
  provider_errors: number;
}

const VIDE: StatsPlateforme = {
  organizations_total: 0,
  organizations_new: 0,
  organizations_activated: 0,
  subscriptions_active: 0,
  calls_total: 0,
  calls_completed: 0,
  calls_failed: 0,
  calls_duration_seconds: 0,
  appointments_created: 0,
  appointments_confirmed: 0,
  leads_created: 0,
  tasks_created: 0,
  urgent_leads: 0,
  messages_sent: 0,
  messages_failed: 0,
  provider_errors: 0,
};

export const PERIODES = [
  { cle: "7", libelle: "7 jours", jours: 7 },
  { cle: "30", libelle: "30 jours", jours: 30 },
  { cle: "90", libelle: "90 jours", jours: 90 },
] as const;

export type ClePeriode = (typeof PERIODES)[number]["cle"];

export function periodeDepuis(
  cle: string | undefined,
): (typeof PERIODES)[number] {
  return PERIODES.find((p) => p.cle === cle) ?? PERIODES[1];
}

export async function statsPlateforme(
  jours: number,
): Promise<{ stats: StatsPlateforme; erreur: boolean }> {
  const supabase = await createServerSupabase();
  const depuis = new Date(Date.now() - jours * 86_400_000).toISOString();

  const { data, error } = await supabase.rpc("platform_stats", {
    depuis,
    jusqua: new Date().toISOString(),
  });

  const ligne = (Array.isArray(data) ? data[0] : data) as
    StatsPlateforme | undefined;
  if (error || !ligne) return { stats: VIDE, erreur: true };

  return { stats: ligne, erreur: false };
}

export interface JourSerie {
  jour: string;
  calls: number;
  calls_failed: number;
  leads: number;
  appointments: number;
  organizations_new: number;
  minutes: number;
}

export async function serieQuotidienne(jours: number): Promise<JourSerie[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("platform_series", { jours });
  return ((data ?? []) as JourSerie[]).map((ligne) => ({
    ...ligne,
    minutes: Number(ligne.minutes ?? 0),
  }));
}

export interface ConsommationLigne {
  kind: string;
  total: number;
  organisations: number;
}

export async function consommationTotale(
  depuis: Date,
): Promise<ConsommationLigne[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("usage_totals", {
    depuis: depuis.toISOString(),
  });
  return ((data ?? []) as ConsommationLigne[]).map((l) => ({
    ...l,
    total: Number(l.total ?? 0),
  }));
}

export const LIBELLES_USAGE: Record<string, { nom: string; unite: string }> = {
  VOICE_MINUTES: { nom: "Minutes d’appel", unite: " min" },
  SMS_SENT: { nom: "SMS envoyés", unite: "" },
  AI_USAGE: { nom: "Résumés produits", unite: "" },
  STORAGE: { nom: "Stockage", unite: " Mo" },
};

/** Durée totale, lisible. « 23 400 secondes » ne dit rien à personne. */
export function dureeLisible(secondes: number): string {
  if (secondes < 60) return `${secondes} s`;
  const minutes = Math.round(secondes / 60);
  if (minutes < 120) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0 ? `${heures} h` : `${heures} h ${reste}`;
}

/**
 * Part en pourcentage, sans division par zéro.
 *
 * Renvoie `null` plutôt que 0 quand il n'y a rien à diviser : « 0 % de réussite »
 * sur zéro appel est faux, et c'est le genre de chiffre qui déclenche une
 * fausse alerte un lundi matin.
 */
export function part(valeur: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((valeur / total) * 100);
}
