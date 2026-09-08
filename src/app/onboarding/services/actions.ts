"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

export interface ServicesState {
  error?: string;
  success?: string;
}

const newService = z.object({
  name: z.string().trim().min(2, "Donnez un nom au service").max(120),
  durationMinutes: z.coerce.number().int().min(5).max(1440),
  isUrgent: z.boolean(),
  priceIndication: z.string().trim().max(200).optional(),
});

export async function addService(
  _prev: ServicesState,
  formData: FormData,
): Promise<ServicesState> {
  const parsed = newService.safeParse({
    name: formData.get("name"),
    durationMinutes: formData.get("durationMinutes"),
    isUrgent: formData.get("isUrgent") === "on",
    priceIndication: formData.get("priceIndication") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { error } = await supabase.from("services").insert({
    organization_id: activeOrganization.organization_id,
    name: parsed.data.name,
    duration_minutes: parsed.data.durationMinutes,
    is_urgent: parsed.data.isUrgent,
    price_indication: parsed.data.priceIndication || null,
    source: "CUSTOM",
    sort_order: 500,
  });

  if (error) {
    // 23505 = violation d'unicité : ce service existe déjà.
    if (error.code === "23505") {
      return { error: "Ce service existe déjà dans votre liste." };
    }
    return { error: "Le service n'a pas pu être ajouté. Réessayez." };
  }

  revalidatePath("/onboarding/services");
  return { success: `« ${parsed.data.name} » ajouté.` };
}

export async function toggleService(serviceId: string, isActive: boolean) {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  // RLS filtre déjà sur l'organisation ; le filtre explicite empêche en plus
  // qu'un identifiant d'une autre organisation renvoie un succès silencieux.
  await supabase
    .from("services")
    .update({ is_active: isActive })
    .eq("id", serviceId)
    .eq("organization_id", activeOrganization.organization_id);

  revalidatePath("/onboarding/services");
}

export async function updateDuration(serviceId: string, minutes: number) {
  const safe = Math.min(Math.max(Math.round(minutes), 5), 1440);
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  await supabase
    .from("services")
    .update({ duration_minutes: safe })
    .eq("id", serviceId)
    .eq("organization_id", activeOrganization.organization_id);

  revalidatePath("/onboarding/services");
}

export async function continueToSchedule() {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { count } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", activeOrganization.organization_id)
    .eq("is_active", true);

  if (!count) {
    // Sophie ne peut rien proposer si l'entreprise n'offre aucun service.
    return { error: "Gardez au moins un service actif pour que Sophie puisse qualifier les demandes." };
  }

  await supabase.rpc("set_onboarding_step", {
    org_id: activeOrganization.organization_id,
    step: "SCHEDULE",
  });

  redirect("/onboarding/horaires");
}
