"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  clampRetention,
} from "@/lib/org/retention";

const jours = z.coerce
  .number()
  .int()
  .min(MIN_RETENTION_DAYS)
  .max(MAX_RETENTION_DAYS);

const schema = z.object({
  transcriptions: jours,
  resumes: jours,
  messages: jours,
});

export interface RetentionState {
  error?: string;
  success?: string;
}

/**
 * Enregistre les trois durées de conservation.
 *
 * Les trois durées sont indépendantes : garder un résumé deux ans et jeter la
 * transcription au bout de trois mois est un choix légitime, et l'inverse
 * aussi. On ne force donc aucun ordre entre elles — seulement les bornes, qui
 * sont vérifiées ici et en base.
 *
 * Les durées ne sont pas appliquées par cet écran. Elles sont lues par les
 * fonctions de purge (`purge_expired_transcripts` et ses voisines), déclenchées
 * par la tâche planifiée. Changer une durée ici ne supprime rien
 * immédiatement : la purge suivante s'en charge.
 */
export async function saveRetention(
  _prev: RetentionState,
  formData: FormData,
): Promise<RetentionState> {
  const parsed = schema.safeParse({
    transcriptions: formData.get("transcriptions"),
    resumes: formData.get("resumes"),
    messages: formData.get("messages"),
  });

  if (!parsed.success) {
    return {
      error: `Chaque durée doit être comprise entre ${MIN_RETENTION_DAYS} et ${MAX_RETENTION_DAYS} jours.`,
    };
  }

  const { activeOrganization } = await requireOrganization();

  if (
    activeOrganization.role !== "OWNER" &&
    activeOrganization.role !== "ADMIN"
  ) {
    return {
      error: "Seul le responsable de l'entreprise peut modifier ce réglage.",
    };
  }

  const transcriptions = clampRetention(parsed.data.transcriptions);
  const resumes = clampRetention(parsed.data.resumes);
  const messages = clampRetention(parsed.data.messages);

  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("organizations")
    .update({
      transcript_retention_days: transcriptions,
      summary_retention_days: resumes,
      message_retention_days: messages,
    })
    .eq("id", activeOrganization.organization_id);

  if (error) {
    return { error: "Le réglage n'a pas pu être enregistré. Réessayez." };
  }

  revalidatePath("/app/reglages/conservation");

  return { success: "Durées de conservation enregistrées." };
}
