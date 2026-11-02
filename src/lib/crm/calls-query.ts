import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Lecture paginée et filtrée des appels.
 *
 * Tout passe par la fonction `search_calls` : filtres, tri, comptage. Le
 * navigateur ne reçoit jamais plus d'une page, et le total reste juste.
 *
 * Deux raisons de ne pas filtrer côté application, apprises en route : le
 * filtre « sans suite » demande de savoir si un appel a produit quelque chose,
 * ce qui ne se calcule pas sur une page partielle ; et un total faux est pire
 * qu'une absence de total, parce qu'on le croit.
 */

export type FiltreAppels =
  | "TOUS"
  | "SANS_SUITE"
  | "ECHOUES"
  | "AVEC_RDV"
  | "URGENTS"
  | "ESSAIS"
  | "TERMINES";

export const FILTRES: { cle: FiltreAppels; libelle: string }[] = [
  { cle: "TOUS", libelle: "Tous" },
  { cle: "SANS_SUITE", libelle: "Sans suite" },
  { cle: "AVEC_RDV", libelle: "Rendez-vous" },
  { cle: "URGENTS", libelle: "Urgents" },
  { cle: "ECHOUES", libelle: "Échoués" },
  { cle: "ESSAIS", libelle: "Essais" },
];

export type Periode = "TOUT" | "AUJOURD_HUI" | "7J" | "30J";

export const PERIODES: { cle: Periode; libelle: string }[] = [
  { cle: "TOUT", libelle: "Depuis toujours" },
  { cle: "AUJOURD_HUI", libelle: "Aujourd’hui" },
  { cle: "7J", libelle: "7 derniers jours" },
  { cle: "30J", libelle: "30 derniers jours" },
];

export interface LigneAppel {
  id: string;
  from_e164: string | null;
  status: string;
  started_at: string;
  duration_seconds: number | null;
  is_test: boolean;
  contact_id: string | null;
  contact_name: string | null;
  summary: string | null;
  has_recording: boolean;
  has_summary: boolean;
  is_urgent: boolean;
  has_appointment: boolean;
  without_followup: boolean;
}

export interface PageAppels {
  appels: LigneAppel[];
  total: number;
  page: number;
  taille: number;
  pages: number;
  erreur: boolean;
}

/** Début de la période demandée, dans le fuseau de l'entreprise. */
export function debutPeriode(periode: Periode, maintenant = new Date()): string | null {
  switch (periode) {
    case "AUJOURD_HUI": {
      const jour = new Date(maintenant);
      jour.setHours(0, 0, 0, 0);
      return jour.toISOString();
    }
    case "7J":
      return new Date(maintenant.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30J":
      return new Date(maintenant.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return null;
  }
}

export async function listerAppels(params: {
  organizationId: string;
  terme?: string;
  filtre?: FiltreAppels;
  periode?: Periode;
  corbeille?: boolean;
  page?: number;
  taille?: number;
}): Promise<PageAppels> {
  const taille = Math.min(Math.max(params.taille ?? 20, 1), 50);
  const page = Math.max(params.page ?? 1, 1);

  const supabase = await createServerSupabase();

  const { data, error } = await supabase.rpc("search_calls", {
    org_id: params.organizationId,
    terme: params.terme?.trim() || null,
    statut: params.filtre ?? "TOUS",
    depuis: debutPeriode(params.periode ?? "TOUT"),
    jusqu_a: null,
    inclure_essais: true,
    dans_corbeille: params.corbeille ?? false,
    page,
    taille,
  });

  if (error) {
    console.error("[appels] recherche impossible", error.message);
    return { appels: [], total: 0, page, taille, pages: 0, erreur: true };
  }

  const lignes = (data ?? []) as (LigneAppel & { total_count: number })[];
  const total = Number(lignes[0]?.total_count ?? 0);

  return {
    // `total_count` est repete sur chaque ligne par la fonction SQL : on le
    // lit une fois et on ne le transporte pas jusqu'a l'affichage.
    appels: lignes.map((ligne) => {
      const copie: Partial<Record<keyof typeof ligne, unknown>> = { ...ligne };
      delete copie.total_count;
      return copie as unknown as LigneAppel;
    }),
    total,
    page,
    taille,
    pages: Math.max(1, Math.ceil(total / taille)),
    erreur: false,
  };
}

/** Bornes affichées : « 1 à 10 sur 147 ». */
export function bornesAffichees(page: PageAppels): { debut: number; fin: number } {
  if (page.total === 0) return { debut: 0, fin: 0 };
  const debut = (page.page - 1) * page.taille + 1;
  return { debut, fin: Math.min(debut + page.appels.length - 1, page.total) };
}
