"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { instantDepuisHeureLocale } from "@/lib/crm/timezone";

export interface AbsenceState {
  error?: string;
  success?: string;
}

const schema = z.object({
  kind: z.enum(["VACATION", "ABSENCE", "HOLIDAY"]),
  label: z.string().trim().max(120).optional(),
  debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de début invalide"),
  fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de fin invalide"),
});

/**
 * Ajoute une absence.
 *
 * Les dates saisies sont des JOURS, pas des instants. « Du 10 au 14 » veut
 * dire « jusqu'au 14 inclus, au soir » : on borne à minuit le lendemain, dans
 * le fuseau de l'entreprise. Prendre la date telle quelle libérerait toute la
 * journée du 14, et Sophie proposerait un rendez-vous pendant les vacances.
 */
export async function ajouterAbsence(
  _prev: AbsenceState,
  formData: FormData,
): Promise<AbsenceState> {
  const parsed = schema.safeParse({
    kind: formData.get("kind") ?? "ABSENCE",
    label: formData.get("label") ?? undefined,
    debut: formData.get("debut"),
    fin: formData.get("fin"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();
  const orgId = activeOrganization.organization_id;

  const { data: org } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", orgId)
    .maybeSingle();

  const fuseau = (org?.timezone as string | undefined) ?? "Europe/Brussels";

  const debut = instantDepuisHeureLocale(parsed.data.debut, "00:00", fuseau);
  const finJour = new Date(`${parsed.data.fin}T00:00:00Z`);
  finJour.setUTCDate(finJour.getUTCDate() + 1);
  const fin = instantDepuisHeureLocale(finJour.toISOString().slice(0, 10), "00:00", fuseau);

  if (!debut || !fin) return { error: "Dates incompréhensibles." };
  if (fin.getTime() <= debut.getTime()) {
    return { error: "La fin doit être après le début." };
  }

  const { error } = await supabase.from("absences").insert({
    organization_id: orgId,
    kind: parsed.data.kind,
    label: parsed.data.label || null,
    starts_at: debut.toISOString(),
    ends_at: fin.toISOString(),
  });

  if (error) {
    return { error: "L’absence n’a pas pu être enregistrée." };
  }

  revalidatePath("/app/reglages/absences");
  revalidatePath("/app/agenda");
  return { success: "Absence enregistrée. Sophie ne proposera plus ces jours-là." };
}

export async function supprimerAbsence(absenceId: string): Promise<{ ok: boolean }> {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("absences")
    .delete()
    .eq("id", absenceId)
    .eq("organization_id", activeOrganization.organization_id);

  revalidatePath("/app/reglages/absences");
  revalidatePath("/app/agenda");
  return { ok: !error };
}
