"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { MAX_AUDIO_RETENTION_DAYS, clampRetentionDays } from "@/lib/org/recording";

const schema = z.object({
  accepte: z.boolean(),
  enregistrer: z.boolean(),
  retention: z.coerce.number().int().min(1).max(MAX_AUDIO_RETENTION_DAYS),
});

export interface RecordingState {
  error?: string;
  success?: string;
}

/**
 * Enregistre la politique d'enregistrement de l'entreprise.
 *
 * Deux garde-fous que l'interface ne peut pas contourner.
 *
 * **L'activation exige l'acceptation.** On ne peut pas enregistrer des appels
 * sans avoir lu et accepté ce qui en découle. La base le vérifie aussi
 * (`recording_allowed()`), et c'est elle qui décide pendant un appel.
 *
 * **Retirer l'acceptation éteint l'enregistrement.** Sinon une entreprise
 * pourrait se retrouver à enregistrer sans accord valide, ce qui est exactement
 * la situation que l'acceptation doit empêcher.
 */
export async function saveRecordingPolicy(
  _prev: RecordingState,
  formData: FormData,
): Promise<RecordingState> {
  const parsed = schema.safeParse({
    accepte: formData.get("accepte") === "on",
    enregistrer: formData.get("enregistrer") === "on",
    retention: formData.get("retention") ?? MAX_AUDIO_RETENTION_DAYS,
  });

  if (!parsed.success) {
    return { error: "Durée de conservation invalide : entre 1 et 30 jours." };
  }

  const { activeOrganization } = await requireOrganization();

  if (activeOrganization.role !== "OWNER" && activeOrganization.role !== "ADMIN") {
    return { error: "Seul le responsable de l'entreprise peut modifier ce réglage." };
  }

  const { accepte, retention } = parsed.data;
  const enregistrer = accepte && parsed.data.enregistrer;

  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("organizations")
    .update({
      recording_enabled: enregistrer,
      audio_retention_days: clampRetentionDays(retention),
      // On conserve la date d'acceptation existante plutôt que de la rafraîchir
      // à chaque enregistrement du formulaire : c'est une date de consentement,
      // pas une date de dernière modification.
      recording_policy_accepted_at: accepte
        ? (activeOrganization.recording_policy_accepted_at ?? new Date().toISOString())
        : null,
    })
    .eq("id", activeOrganization.organization_id);

  if (error) {
    return { error: "Le réglage n'a pas pu être enregistré. Réessayez." };
  }

  revalidatePath("/app/sophie/enregistrement");
  revalidatePath("/app/sophie");

  return {
    success: enregistrer
      ? "Les appels seront conservés chez vous."
      : "Aucun enregistrement ne sera conservé.",
  };
}
