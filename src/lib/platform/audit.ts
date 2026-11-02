import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Journal de sécurité des actions d'administration (section 35).
 *
 * Toute action du super administrateur qui modifie la plateforme y passe. La
 * raison est simple : cet espace permet de changer ce que Sophie dira à des
 * clients de toutes les entreprises. Une telle capacité sans trace est une
 * capacité que personne ne peut contrôler, à commencer par celui qui l'exerce.
 *
 * Volontairement séparé des `activities`, qui sont le fil lisible par le
 * tenant. Ce journal-ci ne lui est jamais exposé.
 */
export async function journaliserAdmin(params: {
  actorUserId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  organizationId?: string | null;
  outcome?: "SUCCESS" | "DENIED" | "ERROR";
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      organization_id: params.organizationId ?? null,
      actor_user_id: params.actorUserId,
      action: params.action,
      resource_type: params.resourceType ?? null,
      resource_id: params.resourceId ?? null,
      outcome: params.outcome ?? "SUCCESS",
      details: params.details ?? {},
    });
  } catch {
    /* le journal ne doit pas faire echouer l'action qu'il decrit */
  }
}
