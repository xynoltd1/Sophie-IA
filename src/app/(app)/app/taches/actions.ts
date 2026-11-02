"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { instantDepuisHeureLocale } from "@/lib/crm/timezone";

export interface TacheState {
  error?: string;
  success?: string;
}

const creation = z.object({
  titre: z
    .string()
    .trim()
    .min(2, "Décrivez la tâche en quelques mots.")
    .max(200),
  echeance: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
});

/**
 * Une tâche prise à la main, depuis la liste.
 *
 * L'échéance est une date, pas un horaire : « rappeler Dupont jeudi » n'a pas
 * d'heure. Elle est donc posée en fin de journée dans le fuseau de
 * l'entreprise, et non à minuit UTC. À minuit UTC, une tâche due jeudi devient
 * « en retard » le jeudi à une heure du matin — pendant la journée même où
 * elle doit être faite (ADR-029).
 */
export async function creerTache(
  _prev: TacheState,
  formData: FormData,
): Promise<TacheState> {
  const parsed = creation.safeParse({
    titre: formData.get("titre"),
    echeance: formData.get("echeance") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { data: org } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", activeOrganization.organization_id)
    .maybeSingle();

  const fuseau = (org?.timezone as string | undefined) ?? "Europe/Brussels";

  const echeance = parsed.data.echeance
    ? instantDepuisHeureLocale(parsed.data.echeance, "23:59", fuseau)
    : null;

  const { error } = await supabase.from("tasks").insert({
    organization_id: activeOrganization.organization_id,
    title: parsed.data.titre,
    due_at: echeance ? echeance.toISOString() : null,
    source: "MANUAL",
  });

  if (error) return { error: "La tâche n'a pas pu être créée. Réessayez." };

  revalidatePath("/app/taches");
  revalidatePath("/app");
  return { success: "Tâche ajoutée." };
}

const changement = z.object({
  id: z.string().uuid(),
  fait: z.enum(["true", "false"]),
});

/**
 * Cocher ou décocher une tâche.
 *
 * `completed_at` n'est pas écrit ici : un déclencheur en base le pose et le
 * retire selon le statut (migration 0013). Deux endroits qui écrivent la même
 * date finissent toujours par la contredire.
 */
export async function basculerTache(formData: FormData): Promise<void> {
  const parsed = changement.safeParse({
    id: formData.get("id"),
    fait: formData.get("fait"),
  });
  if (!parsed.success) return;

  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  await supabase
    .from("tasks")
    .update({ status: parsed.data.fait === "true" ? "DONE" : "OPEN" })
    .eq("id", parsed.data.id)
    .eq("organization_id", activeOrganization.organization_id);

  revalidatePath("/app/taches");
  revalidatePath("/app");
}
