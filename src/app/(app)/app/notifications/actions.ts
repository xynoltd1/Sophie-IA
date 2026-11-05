"use server";

import { revalidatePath } from "next/cache";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Marquer une notification comme lue.
 *
 * L'écriture passe par le client de session, donc par RLS : la policy n'ouvre
 * que les notifications de l'organisation active, et seulement celles qui sont
 * adressées à tout le monde ou à l'utilisateur lui-même.
 */
export async function marquerLue(
  notificationId: string,
): Promise<{ ok: boolean }> {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("organization_id", activeOrganization.organization_id)
    .is("read_at", null);

  revalidatePath("/app/notifications");
  revalidatePath("/app");
  return { ok: !error };
}

/** Tout marquer comme lu. Le seul geste de masse autorisé : il ne détruit rien. */
export async function toutMarquerLu(): Promise<{ ok: boolean }> {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", activeOrganization.organization_id)
    .is("read_at", null);

  revalidatePath("/app/notifications");
  revalidatePath("/app");
  return { ok: !error };
}
