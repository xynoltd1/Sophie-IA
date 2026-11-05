"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createServerSupabase } from "@/lib/supabase/server";
import { journaliserAdmin } from "@/lib/platform/audit";

export interface PlanState {
  error?: string;
  success?: string;
}

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(
      /^[A-Z][A-Z0-9_]{1,30}$/,
      "Code : majuscules, chiffres, tirets bas.",
    ),
  label: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
  // Un prix vide reste vide : le cahier des charges interdit d'inventer un
  // tarif (section 38). Zéro voudrait dire « gratuit », ce qui est faux.
  prixEuros: z.string().trim().optional(),
  minutes: z.coerce.number().int().min(0).max(100000),
  sms: z.coerce.number().int().min(0).max(100000),
  membres: z.string().trim().optional(),
  isPublic: z.boolean(),
});

export async function enregistrerPlan(
  _prev: PlanState,
  formData: FormData,
): Promise<PlanState> {
  const { userId } = await requirePlatformAdmin();

  const parsed = schema.safeParse({
    code: formData.get("code"),
    label: formData.get("label"),
    description: formData.get("description") ?? undefined,
    prixEuros: formData.get("prixEuros") ?? undefined,
    minutes: formData.get("minutes") ?? 0,
    sms: formData.get("sms") ?? 0,
    membres: formData.get("membres") ?? undefined,
    isPublic: formData.get("isPublic") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const prix = parsed.data.prixEuros?.replace(",", ".").trim();
  const centimes =
    prix && prix.length > 0 ? Math.round(Number(prix) * 100) : null;

  if (centimes !== null && (!Number.isFinite(centimes) || centimes < 0)) {
    return { error: "Prix invalide." };
  }

  const membres = parsed.data.membres?.trim();
  const maxMembres = membres && membres.length > 0 ? Number(membres) : null;

  if (
    maxMembres !== null &&
    (!Number.isInteger(maxMembres) || maxMembres < 1)
  ) {
    return { error: "Nombre de membres invalide." };
  }

  const supabase = await createServerSupabase();

  const { error } = await supabase.from("plans").upsert(
    {
      code: parsed.data.code,
      label: parsed.data.label,
      description: parsed.data.description || null,
      monthly_price_cents: centimes,
      included_voice_minutes: parsed.data.minutes,
      included_sms: parsed.data.sms,
      max_members: maxMembres,
      is_public: parsed.data.isPublic,
    },
    { onConflict: "code" },
  );

  if (error) return { error: "L’offre n’a pas pu être enregistrée." };

  await journaliserAdmin({
    actorUserId: userId,
    action: "PLAN_UPSERT",
    resourceType: "plan",
    resourceId: parsed.data.code,
    details: { prix_centimes: centimes, public: parsed.data.isPublic },
  });

  revalidatePath("/admin/plans");
  return { success: "Offre enregistrée." };
}
