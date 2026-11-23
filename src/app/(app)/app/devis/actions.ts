"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createServerSupabase } from "@/lib/supabase/server";
import { attribuerNumero } from "@/lib/quotes/queries";
import { messageErreurBase } from "@/lib/db/erreurs";

export interface DevisState {
  error?: string;
  success?: string;
}

/**
 * Les montants ne viennent jamais du navigateur.
 *
 * Le formulaire envoie une quantité, un prix unitaire et un taux. Les totaux
 * sont refaits en base, par déclencheur, à chaque écriture de ligne. Accepter
 * un total envoyé par le client reviendrait à le laisser choisir ce qu'il
 * facture.
 */
const ligneSchema = z.object({
  quote_id: z.string().uuid(),
  label: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  quantity: z.coerce.number().positive().max(100000),
  unit: z.string().trim().max(20).optional(),
  // Saisi en euros à l'écran, rangé en centimes.
  unit_price: z.coerce.number().min(0).max(1_000_000),
  vat_rate: z.coerce.number().min(0).max(100),
  service_id: z.string().uuid().optional().or(z.literal("")),
});

/**
 * Crée un brouillon, puis ouvre sa fiche.
 *
 * ## Pourquoi cette action rend un état au lieu de lever une erreur
 *
 * La première version faisait `throw`. Une erreur levée dans une action
 * serveur ne remonte pas à l'écran : Next affiche sa page « Application
 * error » et un numéro. L'artisan voit une page blanche et ne sait ni ce qui
 * s'est passé, ni quoi faire.
 *
 * Elle rend donc un message lisible, et ne quitte l'écran qu'en cas de
 * succès. `redirect` est appelé en dehors du bloc d'erreurs, parce qu'il
 * fonctionne lui-même en levant une exception : l'attraper annulerait la
 * navigation.
 */
export async function creerDevis(
  _prev: DevisState,
  formData: FormData,
): Promise<DevisState> {
  const { activeOrganization: org, user } = await requireOrganization();

  if (!can(org.role, "leads:manage")) {
    return { error: "Votre rôle ne permet pas de créer un devis." };
  }

  const titre = String(formData.get("title") ?? "").trim() || "Devis";
  const contactId = String(formData.get("contact_id") ?? "").trim();
  const leadId = String(formData.get("lead_id") ?? "").trim();

  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      organization_id: org.organization_id,
      title: titre.slice(0, 200),
      contact_id: contactId || null,
      lead_id: leadId || null,
      customer_name: String(formData.get("customer_name") ?? "").trim() || null,
      // Trente jours : l'usage pour un devis de dépannage. L'artisan peut
      // changer la date, et un devis sans échéance ne s'éteint jamais.
      valid_until: new Date(Date.now() + 30 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: messageErreurBase(error, "Création refusée.") };
  }

  redirect(`/app/devis/${data.id}`);
}

export async function ajouterLigne(
  _prev: DevisState,
  formData: FormData,
): Promise<DevisState> {
  const { activeOrganization: org } = await requireOrganization();

  if (!can(org.role, "leads:manage")) {
    return { error: "Votre rôle ne permet pas de modifier un devis." };
  }

  const lecture = ligneSchema.safeParse({
    quote_id: formData.get("quote_id"),
    label: formData.get("label"),
    description: formData.get("description") || undefined,
    quantity: formData.get("quantity"),
    unit: formData.get("unit") || undefined,
    unit_price: formData.get("unit_price"),
    vat_rate: formData.get("vat_rate"),
    service_id: formData.get("service_id") || undefined,
  });

  if (!lecture.success) {
    return {
      error:
        "Vérifiez la désignation, la quantité et le prix. La quantité doit être supérieure à zéro.",
    };
  }

  const ligne = lecture.data;
  const supabase = await createServerSupabase();

  const { error } = await supabase.from("quote_lines").insert({
    quote_id: ligne.quote_id,
    organization_id: org.organization_id,
    service_id: ligne.service_id || null,
    label: ligne.label,
    description: ligne.description ?? null,
    quantity: ligne.quantity,
    unit: ligne.unit ?? null,
    unit_price_cents: Math.round(ligne.unit_price * 100),
    vat_rate: ligne.vat_rate,
    sort_order: Date.now() % 100000,
  });

  if (error) {
    // Le déclencheur de la base refuse toute écriture sur un devis envoyé.
    return { error: messageErreurBase(error, "Ligne refusée.") };
  }

  revalidatePath(`/app/devis/${ligne.quote_id}`);
  return { success: "Ligne ajoutée." };
}

export async function supprimerLigne(formData: FormData): Promise<void> {
  const { activeOrganization: org } = await requireOrganization();
  if (!can(org.role, "leads:manage")) return;

  const ligneId = String(formData.get("ligne_id") ?? "");
  const devisId = String(formData.get("quote_id") ?? "");

  const supabase = await createServerSupabase();
  await supabase.from("quote_lines").delete().eq("id", ligneId);

  revalidatePath(`/app/devis/${devisId}`);
}

/**
 * L'envoi.
 *
 * C'est ici que le devis reçoit son numéro et que ses lignes se figent. Un
 * devis envoyé puis modifié laisserait deux versions en circulation : celle
 * que le client a reçue, et celle que l'entreprise voit.
 *
 * Ce qui n'est PAS fait ici, et que l'écran dit : le document n'est pas encore
 * transmis au client. Le lien public et le PDF sont l'étape suivante. Marquer
 * « envoyé » sans rien envoyer serait exactement le genre de bouton décoratif
 * que le cahier des charges interdit — d'où le texte de confirmation, qui
 * nomme ce que l'action fait vraiment.
 */
export async function envoyerDevis(
  _prev: DevisState,
  formData: FormData,
): Promise<DevisState> {
  const { activeOrganization: org } = await requireOrganization();

  if (!can(org.role, "leads:manage")) {
    return { error: "Votre rôle ne permet pas d’envoyer un devis." };
  }

  const devisId = String(formData.get("quote_id") ?? "");
  const supabase = await createServerSupabase();

  const { data: devis } = await supabase
    .from("quotes")
    .select("status, total_incl_cents")
    .eq("id", devisId)
    .maybeSingle();

  if (!devis) return { error: "Devis introuvable." };
  if (devis.status !== "BROUILLON") {
    return { error: "Ce devis a déjà été figé." };
  }
  if ((devis.total_incl_cents as number) <= 0) {
    return { error: "Un devis sans ligne chiffrée ne peut pas être figé." };
  }

  const numero = await attribuerNumero(devisId);
  if (!numero) return { error: "Le numéro n’a pas pu être attribué." };

  const { error } = await supabase
    .from("quotes")
    .update({ status: "ENVOYE", sent_at: new Date().toISOString() })
    .eq("id", devisId);

  if (error) return { error: error.message };

  revalidatePath(`/app/devis/${devisId}`);
  revalidatePath("/app/devis");

  return {
    success: `Devis ${numero} figé. Il n’est plus modifiable. L’envoi au client arrive à la prochaine étape.`,
  };
}

const DECISIONS = new Set(["ACCEPTE", "REFUSE"]);

export async function deciderDevis(
  _prev: DevisState,
  formData: FormData,
): Promise<DevisState> {
  const { activeOrganization: org } = await requireOrganization();

  if (!can(org.role, "leads:manage")) {
    return { error: "Votre rôle ne permet pas de modifier un devis." };
  }

  const devisId = String(formData.get("quote_id") ?? "");
  const decision = String(formData.get("decision") ?? "");

  if (!DECISIONS.has(decision)) return { error: "Décision inconnue." };

  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("quotes")
    .update({
      status: decision,
      decided_at: new Date().toISOString(),
      decline_reason:
        decision === "REFUSE"
          ? String(formData.get("reason") ?? "")
              .trim()
              .slice(0, 500) || null
          : null,
    })
    .eq("id", devisId);

  if (error) return { error: error.message };

  revalidatePath(`/app/devis/${devisId}`);
  revalidatePath("/app/devis");

  return {
    success:
      decision === "ACCEPTE" ? "Devis marqué accepté." : "Devis marqué refusé.",
  };
}
