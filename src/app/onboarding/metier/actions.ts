"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

const schema = z.object({
  templateId: z.string().uuid("Choisissez un métier"),
  customLabel: z.string().trim().max(80).optional(),
});

export interface StepState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function chooseProfession(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const parsed = schema.safeParse({
    templateId: formData.get("templateId"),
    customLabel: formData.get("customLabel") ?? undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: { templateId: "Choisissez un métier pour continuer." } };
  }

  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  // La fonction SQL crée le profil, les services suggérés, les horaires par
  // défaut et la configuration de Sophie en une seule transaction.
  const applied = await supabase.rpc("apply_profession_template", {
    org_id: activeOrganization.organization_id,
    template_id: parsed.data.templateId,
    custom_label: parsed.data.customLabel || null,
  });

  if (applied.error) {
    const message = applied.error.message.includes("precision libre")
      ? "Précisez votre métier pour continuer."
      : "Le métier n'a pas pu être enregistré. Réessayez dans un instant.";
    return { error: message };
  }

  const advanced = await supabase.rpc("set_onboarding_step", {
    org_id: activeOrganization.organization_id,
    step: "SERVICES",
  });

  if (advanced.error) {
    return { error: "Le métier est enregistré, mais la progression n'a pas pu être sauvegardée." };
  }

  redirect("/onboarding/services");
}
