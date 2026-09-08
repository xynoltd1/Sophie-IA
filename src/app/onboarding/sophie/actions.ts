"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

const schema = z.object({
  assistantName: z.string().trim().min(2, "Donnez un nom à votre assistante").max(40),
  style: z.enum(["CHALEUREUX", "NEUTRE", "DIRECT"]),
  greeting: z.string().trim().max(500).optional(),
  behaviorNotes: z.string().trim().max(2000).optional(),
  discloseAi: z.boolean(),
});

export interface SophieState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function saveSophie(
  _prev: SophieState,
  formData: FormData,
): Promise<SophieState> {
  const parsed = schema.safeParse({
    assistantName: formData.get("assistantName"),
    style: formData.get("style"),
    greeting: formData.get("greeting") ?? undefined,
    behaviorNotes: formData.get("behaviorNotes") ?? undefined,
    discloseAi: formData.get("discloseAi") === "on",
  });

  if (!parsed.success) {
    return { fieldErrors: { assistantName: parsed.error.issues[0]?.message ?? "Formulaire invalide" } };
  }

  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();
  const orgId = activeOrganization.organization_id;

  const { error } = await supabase.from("sophie_configurations").upsert(
    {
      organization_id: orgId,
      assistant_name: parsed.data.assistantName,
      style: parsed.data.style,
      greeting: parsed.data.greeting || null,
      behavior_notes: parsed.data.behaviorNotes || null,
      disclose_ai: parsed.data.discloseAi,
    },
    { onConflict: "organization_id" },
  );

  if (error) {
    return { error: "La configuration n'a pas pu être enregistrée. Réessayez." };
  }

  await supabase.rpc("set_onboarding_step", { org_id: orgId, step: "PHONE" });
  redirect("/onboarding/appels");
}
