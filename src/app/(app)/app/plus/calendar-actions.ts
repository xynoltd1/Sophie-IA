"use server";

import { revalidatePath } from "next/cache";
import { requireOrganization } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { disconnectCalendar, syncCalendar } from "@/lib/providers/calendar/service";

export async function syncCalendarAction(): Promise<{
  ok: boolean;
  imported: number;
  error?: string;
}> {
  const { activeOrganization } = await requireOrganization();

  // Le service d'agenda écrit avec le client d'administration : l'autorisation
  // se vérifie ici, avant, et pas ailleurs.
  if (!can(activeOrganization.role, "organization:update")) {
    return { ok: false, imported: 0, error: "Droits insuffisants." };
  }

  const resultat = await syncCalendar(activeOrganization.organization_id);
  revalidatePath("/app/plus");
  revalidatePath("/app/agenda");

  return { ok: resultat.ok, imported: resultat.imported, error: resultat.error };
}

export async function disconnectCalendarAction(): Promise<void> {
  const { activeOrganization, user } = await requireOrganization();

  if (!can(activeOrganization.role, "organization:update")) return;

  await disconnectCalendar({
    organizationId: activeOrganization.organization_id,
    actorUserId: user.id,
  });

  revalidatePath("/app/plus");
  revalidatePath("/app/agenda");
}
