"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/types/database";

export interface AgendaState {
  error?: string;
  success?: string;
}

const bookSchema = z.object({
  title: z.string().trim().min(2, "Donnez un intitulé au rendez-vous").max(200),
  startsAt: z.string().min(10, "Choisissez un créneau"),
  durationMinutes: z.coerce.number().int().min(5).max(1440),
  contactId: z.string().uuid().optional().or(z.literal("")),
  leadId: z.string().uuid().optional().or(z.literal("")),
});

/**
 * Réserve un créneau.
 *
 * La vérification de disponibilité n'est pas faite ici : elle est faite par la
 * contrainte d'exclusion en base. Vérifier côté application laisserait une
 * fenêtre entre le contrôle et l'insertion, que deux réservations simultanées
 * traverseraient. On tente, et on traduit le refus.
 */
export async function bookAppointment(
  _prev: AgendaState,
  formData: FormData,
): Promise<AgendaState> {
  const parsed = bookSchema.safeParse({
    title: formData.get("title"),
    startsAt: formData.get("startsAt"),
    durationMinutes: formData.get("durationMinutes"),
    contactId: formData.get("contactId") ?? "",
    leadId: formData.get("leadId") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const debut = new Date(parsed.data.startsAt);
  const fin = new Date(debut.getTime() + parsed.data.durationMinutes * 60_000);

  const { error } = await supabase.rpc("book_appointment", {
    org_id: activeOrganization.organization_id,
    titre: parsed.data.title,
    debut: debut.toISOString(),
    fin: fin.toISOString(),
    contact: parsed.data.contactId || null,
    lead: parsed.data.leadId || null,
    service: null,
    intervenant: null,
    statut: "CONFIRMED",
    duree_hold: null,
  });

  if (error) {
    // 23505 : la contrainte d'exclusion a refusé. Quelqu'un a réservé entre-temps.
    if (error.code === "23505" || error.message.includes("vient d etre pris")) {
      return { error: "Ce créneau vient d’être pris. Choisissez-en un autre." };
    }
    return { error: "Le rendez-vous n’a pas pu être créé. Réessayez." };
  }

  revalidatePath("/app/agenda");
  revalidatePath("/app");
  return { success: "Rendez-vous enregistré." };
}

export async function changeAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
) {
  await requireOrganization();
  const supabase = await createServerSupabase();

  const { error } = await supabase.rpc("set_appointment_status", {
    rdv_id: appointmentId,
    statut: status,
    motif: null,
  });

  if (error) {
    return { error: "Le rendez-vous n’a pas pu être mis à jour." };
  }

  revalidatePath("/app/agenda");
  revalidatePath("/app");
  return {};
}
