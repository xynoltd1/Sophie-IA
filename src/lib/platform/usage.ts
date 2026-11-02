import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type GenreUsage = "VOICE_MINUTES" | "SMS_SENT" | "AI_USAGE" | "STORAGE";

/**
 * Enregistre une consommation facturable (section 38).
 *
 * `dedupeKey` est la pièce maîtresse : les webhooks sont rejoués, et compter
 * deux fois les minutes d'un appel ferait facturer deux fois un client. La clé
 * est l'identifiant de la chose consommée — l'appel, le message — et la base
 * refuse le doublon.
 *
 * Ne lève jamais : un compteur raté ne doit pas faire échouer l'appel qu'il
 * compte. L'écart se rattrape, un appel perdu non.
 */
export async function enregistrerUsage(params: {
  organizationId: string;
  kind: GenreUsage;
  quantity: number;
  callId?: string | null;
  messageId?: string | null;
  dedupeKey?: string;
}): Promise<void> {
  if (!Number.isFinite(params.quantity) || params.quantity < 0) return;

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("usage_records").insert({
      organization_id: params.organizationId,
      kind: params.kind,
      quantity: Number(params.quantity.toFixed(3)),
      call_id: params.callId ?? null,
      message_id: params.messageId ?? null,
      dedupe_key: params.dedupeKey ?? null,
    });

    // 23505 = doublon : c'est le comportement voulu, pas une erreur.
    if (error && error.code !== "23505") {
      console.error("[usage] non enregistré", params.kind, error.message);
    }
  } catch {
    /* un compteur raté ne défait rien */
  }
}
