"use server";

import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Créneaux réellement disponibles pour un jour.
 *
 * Le calcul est fait en base par available_slots() : horaires d'ouverture,
 * rendez-vous existants, holds en cours, absences, marge entre interventions.
 * Rien n'est estimé côté application — Sophie ne doit jamais annoncer une
 * disponibilité qui n'existe pas.
 */
export async function fetchSlots(
  jour: string,
  dureeMinutes: number,
): Promise<{ slots: string[]; error?: string }> {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase.rpc("available_slots", {
    org_id: activeOrganization.organization_id,
    jour,
    duree_min: dureeMinutes,
    intervenant: null,
  });

  if (error) {
    return { slots: [], error: "Les disponibilités n’ont pas pu être calculées." };
  }

  const lignes = (data ?? []) as { creneau: string }[];
  return { slots: lignes.map((ligne) => ligne.creneau) };
}
