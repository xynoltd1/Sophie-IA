"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { can } from "@/lib/auth/permissions";
import { checkPhone } from "@/lib/crm/phone";

export interface LigneState {
  error?: string;
  success?: string;
}

const schema = z.object({
  numero: z.string().trim().min(6, "Indiquez le numéro").max(30),
  numeroPublic: z.string().trim().max(30).optional(),
  label: z.string().trim().max(60).optional(),
  mode: z.enum(["FORWARD", "DIRECT", "PORTED"]),
  essai: z.boolean(),
});

/**
 * Déclare le numéro sur lequel Sophie reçoit les appels.
 *
 * Ce que cette action NE fait pas : commander un numéro, l'activer chez
 * l'opérateur, ou vérifier qu'il existe. Elle enregistre un lien entre un
 * numéro et une entreprise. Prétendre activer une ligne qu'on n'a pas
 * commandée serait exactement ce que le cahier des charges interdit.
 *
 * Le numéro doit être écrit en entier, indicatif compris : c'est lui que le
 * fournisseur de téléphonie nous enverra, et la comparaison est exacte.
 */
export async function enregistrerLigne(
  _prev: LigneState,
  formData: FormData,
): Promise<LigneState> {
  const parsed = schema.safeParse({
    numero: formData.get("numero"),
    numeroPublic: formData.get("numeroPublic") ?? undefined,
    label: formData.get("label") ?? undefined,
    mode: formData.get("mode") ?? "FORWARD",
    essai: formData.get("essai") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const { activeOrganization } = await requireOrganization();

  if (!can(activeOrganization.role, "organization:update")) {
    return { error: "Seul un responsable peut déclarer une ligne." };
  }

  const supabase = await createServerSupabase();

  const { data: org } = await supabase
    .from("organizations")
    .select("country_calling_code")
    .eq("id", activeOrganization.organization_id)
    .maybeSingle();

  const indicatif = (org?.country_calling_code as string | undefined) ?? "32";

  const controle = checkPhone(parsed.data.numero, indicatif);
  if (!controle.plausible || !controle.e164) {
    return {
      error:
        controle.reason ??
        "Ce numéro ne ressemble pas à un numéro valide. Écrivez-le en entier, indicatif compris.",
    };
  }

  let numeroPublic: string | null = null;
  if (parsed.data.numeroPublic?.trim()) {
    const controlePublic = checkPhone(parsed.data.numeroPublic, indicatif);
    if (!controlePublic.plausible || !controlePublic.e164) {
      return { error: "Le numéro communiqué à vos clients n’est pas valide." };
    }
    numeroPublic = controlePublic.e164;
  }

  const { error } = await supabase.from("phone_numbers").insert({
    organization_id: activeOrganization.organization_id,
    e164: controle.e164,
    public_number: numeroPublic,
    label: parsed.data.label || null,
    connection_mode: parsed.data.mode,
    is_test: parsed.data.essai,
    is_active: true,
    provider: "VAPI",
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ce numéro est déjà rattaché à une entreprise."
          : "La ligne n’a pas pu être enregistrée.",
    };
  }

  revalidatePath("/app/sophie/ligne");
  revalidatePath("/app");

  return {
    success: parsed.data.essai
      ? "Ligne d’essai enregistrée. Les appels resteront marqués « essai »."
      : "Ligne enregistrée. Les prochains appels seront de vrais appels.",
  };
}

/** Active ou désactive une ligne sans la supprimer. */
export async function basculerLigne(id: string, actif: boolean): Promise<{ ok: boolean }> {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("phone_numbers")
    .update({ is_active: actif })
    .eq("id", id)
    .eq("organization_id", activeOrganization.organization_id);

  revalidatePath("/app/sophie/ligne");
  return { ok: !error };
}

/**
 * Retire une ligne.
 *
 * Les appels déjà reçus sur ce numéro gardent leur `phone_number_id` à null :
 * leur historique reste, et c'est ce qui compte. On ne supprime jamais un
 * appel parce qu'on a changé de numéro.
 */
export async function retirerLigne(id: string): Promise<{ ok: boolean; erreur?: string }> {
  const { activeOrganization } = await requireOrganization();

  if (!can(activeOrganization.role, "organization:update")) {
    return { ok: false, erreur: "Seul un responsable peut retirer une ligne." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("phone_numbers")
    .delete()
    .eq("id", id)
    .eq("organization_id", activeOrganization.organization_id);

  revalidatePath("/app/sophie/ligne");
  return { ok: !error };
}
