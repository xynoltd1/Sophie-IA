"use server";

import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCalendarState, type CalendarConfidence } from "@/lib/crm/calendar-state";

/**
 * Créneaux réellement disponibles pour un jour.
 *
 * Le calcul est fait en base par available_slots() : horaires d'ouverture,
 * rendez-vous existants, holds en cours, absences, marge entre interventions,
 * et occupations importées de l'agenda externe.
 *
 * La confiance accompagne toujours les créneaux. Une liste de créneaux sans
 * indication de fraîcheur laisserait croire qu'ils sont vérifiés alors que
 * l'agenda du professionnel peut être hors de vue (section 19).
 */
export async function fetchSlots(
  jour: string,
  dureeMinutes: number,
): Promise<{ slots: string[]; confidence: CalendarConfidence; error?: string }> {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const [creneaux, etat] = await Promise.all([
    supabase.rpc("available_slots", {
      org_id: activeOrganization.organization_id,
      jour,
      duree_min: dureeMinutes,
      intervenant: null,
    }),
    getCalendarState(activeOrganization.organization_id),
  ]);

  if (creneaux.error) {
    return {
      slots: [],
      confidence: etat.confidence,
      error: "Les disponibilités n\u2019ont pas pu être calculées.",
    };
  }

  const lignes = (creneaux.data ?? []) as { creneau: string }[];
  return {
    slots: lignes.map((ligne) => ligne.creneau),
    confidence: etat.confidence,
  };
}
