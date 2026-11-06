"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

export interface ConnaissanceState {
  error?: string;
  success?: string;
}

const schema = z
  .object({
    kind: z.enum(["FAQ", "INSTRUCTION", "FACT"]),
    question: z.string().trim().max(300).optional(),
    answer: z.string().trim().min(2, "Écrivez la réponse").max(4000),
  })
  .refine((v) => v.kind !== "FAQ" || Boolean(v.question), {
    message: "Une question fréquente a besoin de sa question.",
    path: ["question"],
  });

/**
 * Ajoute une connaissance que Zeli a le droit d'utiliser (section 9).
 *
 * C'est le seul moyen pour le professionnel de corriger Zeli. Le cahier des
 * charges interdit l'apprentissage autonome à partir des appels : ce qu'elle
 * sait vient d'ici, d'un humain qui en répond.
 */
export async function ajouterConnaissance(
  _prev: ConnaissanceState,
  formData: FormData,
): Promise<ConnaissanceState> {
  const parsed = schema.safeParse({
    kind: formData.get("kind") ?? "FAQ",
    question: formData.get("question") ?? undefined,
    answer: formData.get("answer"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { error } = await supabase.from("business_knowledge").insert({
    organization_id: activeOrganization.organization_id,
    kind: parsed.data.kind,
    question: parsed.data.question || null,
    answer: parsed.data.answer,
    is_active: true,
  });

  if (error) return { error: "La connaissance n’a pas pu être enregistrée." };

  revalidatePath("/app/sophie/connaissances");
  return { success: "Zeli peut maintenant s’en servir." };
}

export async function basculerConnaissance(
  id: string,
  actif: boolean,
): Promise<{ ok: boolean }> {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("business_knowledge")
    .update({ is_active: actif })
    .eq("id", id)
    .eq("organization_id", activeOrganization.organization_id);

  revalidatePath("/app/sophie/connaissances");
  return { ok: !error };
}

export async function supprimerConnaissance(
  id: string,
): Promise<{ ok: boolean }> {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("business_knowledge")
    .delete()
    .eq("id", id)
    .eq("organization_id", activeOrganization.organization_id);

  revalidatePath("/app/sophie/connaissances");
  return { ok: !error };
}
