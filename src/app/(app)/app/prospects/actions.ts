"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { canTransition } from "@/lib/crm/pipeline";
import type { LeadStatus } from "@/types/database";

export interface LeadFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const schema = z.object({
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  city: z.string().trim().max(120).optional(),
  title: z.string().trim().min(2, "Décrivez la demande en quelques mots").max(200),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
});

/**
 * Crée un prospect, et le contact s'il n'existe pas encore.
 *
 * La déduplication passe par find_contact_by_phone() : le même numéro saisi
 * « 0470 12 34 56 » ou « +32470123456 » retrouve le même contact. C'est la
 * même fonction que Sophie utilisera en Phase 4 pour reconnaître un appelant,
 * d'où l'intérêt de l'éprouver dès maintenant.
 */
export async function createLead(
  _prev: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const parsed = schema.safeParse({
    contactName: formData.get("contactName") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    city: formData.get("city") ?? undefined,
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    priority: formData.get("priority") ?? "NORMAL",
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { fieldErrors: { [String(issue?.path[0] ?? "title")]: issue?.message ?? "Formulaire invalide" } };
  }

  const { contactName, phone, city, title, description, priority } = parsed.data;

  if (!contactName && !phone) {
    return { fieldErrors: { contactName: "Indiquez au moins un nom ou un numéro de téléphone." } };
  }

  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();
  const orgId = activeOrganization.organization_id;

  let contactId: string | null = null;

  if (phone) {
    const { data: existant } = await supabase.rpc("find_contact_by_phone", {
      org_id: orgId,
      numero: phone,
    });
    if (existant) contactId = String(existant);
  }

  if (!contactId) {
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        organization_id: orgId,
        full_name: contactName || null,
        phone: phone || null,
        city: city || null,
        source: "MANUAL",
      })
      .select("id")
      .single();

    if (error || !data) {
      return { error: "Le contact n’a pas pu être créé. Vérifiez le numéro et réessayez." };
    }
    contactId = data.id;
  } else if (contactName) {
    // Le contact existait : on complète son nom s'il n'en avait pas.
    await supabase
      .from("contacts")
      .update({ full_name: contactName, is_provisional: false })
      .eq("id", contactId)
      .eq("organization_id", orgId)
      .is("full_name", null);
  }

  const { error } = await supabase.from("leads").insert({
    organization_id: orgId,
    contact_id: contactId,
    title,
    description: description || null,
    city: city || null,
    priority,
    status: "NEW",
    source: "MANUAL",
  });

  if (error) {
    return { error: "Le prospect n’a pas pu être créé. Réessayez." };
  }

  revalidatePath("/app/prospects");
  revalidatePath("/app");
  redirect("/app/prospects");
}

/** Fait avancer un prospect dans le pipeline. */
export async function changeLeadStatus(leadId: string, to: LeadStatus) {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();
  const orgId = activeOrganization.organization_id;

  const { data: lead } = await supabase
    .from("leads")
    .select("status, title")
    .eq("id", leadId)
    .eq("organization_id", orgId)
    .single();

  if (!lead) return { error: "Prospect introuvable." };

  // La règle de transition est vérifiée côté serveur, pas seulement dans
  // l'interface : un bouton masqué n'est pas une protection.
  if (!canTransition(lead.status as LeadStatus, to)) {
    return { error: "Ce changement d’étape n’est pas autorisé." };
  }

  const { error } = await supabase
    .from("leads")
    .update({ status: to })
    .eq("id", leadId)
    .eq("organization_id", orgId);

  if (error) return { error: "L’étape n’a pas pu être changée." };

  await supabase.from("activities").insert({
    organization_id: orgId,
    type: "LEAD_STATUS_CHANGED",
    subject_type: "lead",
    subject_id: leadId,
    summary: `${lead.title} : ${to}`,
  });

  revalidatePath("/app/prospects");
  revalidatePath("/app");
  return {};
}
