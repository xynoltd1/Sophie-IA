import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Consigne une panne d'un service externe (section 54).
 *
 * Son utilité est de distinguer deux situations que les journaux applicatifs
 * confondent : « notre code a un bug » et « le fournisseur est tombé ». Sans
 * cette distinction, on corrige du code qui marche.
 *
 * Visible du seul super administrateur : c'est une information d'exploitation,
 * pas une information client.
 */
export async function signalerErreurFournisseur(params: {
  provider: string;
  operation: string;
  message: string;
  organizationId?: string | null;
  correlationId?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("provider_errors").insert({
      organization_id: params.organizationId ?? null,
      provider: params.provider,
      operation: params.operation,
      message: params.message.slice(0, 500),
      correlation_id: params.correlationId ?? null,
    });
  } catch {
    /* journaliser une panne ne doit pas en provoquer une autre */
  }
}
