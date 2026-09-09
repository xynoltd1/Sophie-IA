"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

export interface ContactFormState {
  error?: string;
  success?: string;
}

const contactSchema = z.object({
  contactId: z.string().uuid(),
  fullName: z.string().trim().max(120).optional(),
  companyName: z.string().trim().max(120).optional(),
  email: z.string().trim().email("Adresse e-mail invalide").or(z.literal("")).optional(),
  phone: z.string().trim().max(30).optional(),
  addressLine1: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export async function updateContact(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const { contactId, ...champs } = parsed.data;

  if (!champs.fullName && !champs.companyName && !champs.phone) {
    return { error: "Gardez au moins un nom, une entreprise ou un téléphone." };
  }

  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("contacts")
    .update({
      full_name: champs.fullName || null,
      company_name: champs.companyName || null,
      email: champs.email || null,
      phone: champs.phone || null,
      address_line1: champs.addressLine1 || null,
      city: champs.city || null,
      notes: champs.notes || null,
      // Le contact a été complété à la main : il n'est plus provisoire.
      is_provisional: false,
    })
    .eq("id", contactId)
    .eq("organization_id", activeOrganization.organization_id);

  if (error) {
    // 23505 : un autre contact porte déjà ce numéro dans cette organisation.
    if (error.code === "23505") {
      return { error: "Un autre contact a déjà ce numéro de téléphone." };
    }
    return { error: "Les modifications n’ont pas pu être enregistrées." };
  }

  revalidatePath(`/app/contacts/${contactId}`);
  return { success: "Contact mis à jour." };
}

const taskSchema = z.object({
  contactId: z.string().uuid(),
  title: z.string().trim().min(2, "Décrivez la tâche").max(200),
  dueAt: z.string().optional(),
});

export async function createTask(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = taskSchema.safeParse({
    contactId: formData.get("contactId"),
    title: formData.get("title"),
    dueAt: formData.get("dueAt") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { error } = await supabase.from("tasks").insert({
    organization_id: activeOrganization.organization_id,
    contact_id: parsed.data.contactId,
    title: parsed.data.title,
    // Un champ date vide arrive en chaîne vide : Postgres refuserait.
    due_at: parsed.data.dueAt ? new Date(parsed.data.dueAt).toISOString() : null,
    source: "MANUAL",
  });

  if (error) return { error: "La tâche n’a pas pu être créée." };

  revalidatePath(`/app/contacts/${parsed.data.contactId}`);
  revalidatePath("/app");
  return { success: "Tâche ajoutée." };
}

export async function toggleTask(taskId: string, done: boolean) {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  await supabase
    .from("tasks")
    .update({ status: done ? "DONE" : "OPEN" })
    .eq("id", taskId)
    .eq("organization_id", activeOrganization.organization_id);

  revalidatePath("/app");
}
