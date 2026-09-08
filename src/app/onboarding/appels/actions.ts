"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

const schema = z
  .object({
    answerMode: z.enum(["OFF", "ALWAYS", "WHEN_UNAVAILABLE", "SCHEDULE"]),
    transferNumber: z.string().trim().max(30).optional(),
  })
  .refine(
    (value) => value.answerMode !== "WHEN_UNAVAILABLE" || Boolean(value.transferNumber),
    { message: "Indiquez le numéro vers lequel appeler avant de passer la main à Sophie.", path: ["transferNumber"] },
  );

export interface PhoneState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function savePhoneRules(
  _prev: PhoneState,
  formData: FormData,
): Promise<PhoneState> {
  const parsed = schema.safeParse({
    answerMode: formData.get("answerMode"),
    transferNumber: formData.get("transferNumber") ?? undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { fieldErrors: { [String(issue?.path[0] ?? "answerMode")]: issue?.message ?? "Formulaire invalide" } };
  }

  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();
  const orgId = activeOrganization.organization_id;

  const { error } = await supabase
    .from("sophie_configurations")
    .update({
      answer_mode: parsed.data.answerMode,
      transfer_number: parsed.data.transferNumber || null,
    })
    .eq("organization_id", orgId);

  if (error) {
    return { error: "Ces règles n'ont pas pu être enregistrées. Réessayez." };
  }

  await supabase.rpc("set_onboarding_step", { org_id: orgId, step: "DONE" });
  redirect("/app");
}
