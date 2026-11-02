import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type CategorieNotification = "CRITIQUE" | "ACTION" | "INFO";

/**
 * Prévenir le professionnel (section 34).
 *
 * Trois règles tirées de ce qui rend les notifications inutiles ailleurs.
 *
 * **Chaque notification mène quelque part.** `href` est obligatoire en
 * pratique : une alerte qui oblige à chercher la ressource concernée fait
 * perdre plus de temps qu'elle n'en fait gagner.
 *
 * **Pas de doublon.** `dedupeKey` empêche la même alerte de s'empiler. C'est
 * ainsi qu'on apprend à ignorer ses notifications.
 *
 * **Ne lève jamais.** Prévenir est utile, mais ce n'est pas l'opération
 * principale : un échec de notification ne doit pas faire échouer la création
 * du rendez-vous qu'elle annonce.
 */
export async function notifier(params: {
  organizationId: string;
  category: CategorieNotification;
  title: string;
  body?: string | null;
  href: string;
  subjectType?: string;
  subjectId?: string;
  dedupeKey?: string;
  userId?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert({
      organization_id: params.organizationId,
      user_id: params.userId ?? null,
      category: params.category,
      title: params.title.slice(0, 200),
      body: params.body ?? null,
      href: params.href,
      subject_type: params.subjectType ?? null,
      subject_id: params.subjectId ?? null,
      dedupe_key: params.dedupeKey ?? null,
    });
  } catch {
    /* une alerte ratée ne doit jamais défaire ce qu'elle annonce */
  }
}
