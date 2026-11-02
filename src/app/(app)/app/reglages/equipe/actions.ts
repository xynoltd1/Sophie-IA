"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { can, outranks } from "@/lib/auth/permissions";
import type { MemberRole } from "@/types/database";

export interface EquipeState {
  error?: string;
  success?: string;
  /** Lien d'invitation, affiché UNE SEULE FOIS. */
  lien?: string;
}

/** Le jeton n'est jamais stocké en clair : seule son empreinte l'est. */
function empreinte(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

const inviteSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide").max(200),
  role: z.enum(["ADMIN", "MEMBER"]),
});

/**
 * Invite quelqu'un dans l'entreprise.
 *
 * Aucun e-mail n'est envoyé : aucun fournisseur d'envoi n'est configuré, et
 * prétendre le contraire serait exactement ce que le cahier des charges
 * interdit. Le lien est affiché une fois, au professionnel, qui le transmet
 * comme il veut. C'est moins confortable, et c'est vrai.
 *
 * `OWNER` n'est pas proposé : il n'y a qu'un propriétaire, et le transfert de
 * propriété est une opération à part.
 */
export async function inviterMembre(
  _prev: EquipeState,
  formData: FormData,
): Promise<EquipeState> {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role") ?? "MEMBER",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const { activeOrganization } = await requireOrganization();
  if (!can(activeOrganization.role, "members:invite")) {
    return { error: "Votre rôle ne permet pas d’inviter." };
  }

  const supabase = await createServerSupabase();

  const jeton = randomBytes(32).toString("base64url");

  const { error } = await supabase.from("organization_invitations").insert({
    organization_id: activeOrganization.organization_id,
    email: parsed.data.email,
    role: parsed.data.role,
    token_hash: empreinte(jeton),
    // Sept jours : une invitation qui traîne est une porte ouverte.
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Une invitation est déjà en attente pour cette adresse."
        : "L’invitation n’a pas pu être créée.",
    };
  }

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

  revalidatePath("/app/reglages/equipe");
  return {
    success: "Invitation créée. Transmettez ce lien à la personne concernée.",
    lien: `${base}/invitation/${jeton}`,
  };
}

export async function revoquerInvitation(invitationId: string): Promise<{ ok: boolean }> {
  const { activeOrganization } = await requireOrganization();
  if (!can(activeOrganization.role, "members:invite")) return { ok: false };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("organization_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("organization_id", activeOrganization.organization_id)
    .is("accepted_at", null);

  revalidatePath("/app/reglages/equipe");
  return { ok: !error };
}

/**
 * Change le rôle d'un membre.
 *
 * `canActOn` empêche un administrateur de toucher au propriétaire : sans cette
 * règle, un administrateur pourrait se promouvoir ou évincer celui qui l'a
 * nommé.
 */
export async function changerRole(
  memberUserId: string,
  role: MemberRole,
): Promise<{ ok: boolean; erreur?: string }> {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  if (!can(activeOrganization.role, "members:update_role")) {
    return { ok: false, erreur: "Votre rôle ne permet pas de modifier les droits." };
  }

  const { data: cible } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", activeOrganization.organization_id)
    .eq("user_id", memberUserId)
    .maybeSingle();

  if (!cible) return { ok: false, erreur: "Membre introuvable." };

  if (!outranks(activeOrganization.role, cible.role as MemberRole)) {
    return { ok: false, erreur: "Vous ne pouvez pas modifier ce membre." };
  }

  const { error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("organization_id", activeOrganization.organization_id)
    .eq("user_id", memberUserId);

  revalidatePath("/app/reglages/equipe");
  return { ok: !error, erreur: error ? "Le changement n’a pas pu être enregistré." : undefined };
}

/**
 * Désactive un membre plutôt que de le supprimer.
 *
 * Ses rendez-vous, ses appels et ses actions restent rattachés à lui : effacer
 * la personne effacerait l'histoire de l'entreprise.
 */
export async function desactiverMembre(memberUserId: string): Promise<{ ok: boolean; erreur?: string }> {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  if (!can(activeOrganization.role, "members:remove")) {
    return { ok: false, erreur: "Votre rôle ne permet pas de retirer un membre." };
  }

  const { data: cible } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", activeOrganization.organization_id)
    .eq("user_id", memberUserId)
    .maybeSingle();

  if (!cible) return { ok: false, erreur: "Membre introuvable." };
  if (cible.role === "OWNER") {
    return { ok: false, erreur: "Le propriétaire ne peut pas être retiré." };
  }
  if (!outranks(activeOrganization.role, cible.role as MemberRole)) {
    return { ok: false, erreur: "Vous ne pouvez pas retirer ce membre." };
  }

  const { error } = await supabase
    .from("organization_members")
    .update({ status: "SUSPENDED" })
    .eq("organization_id", activeOrganization.organization_id)
    .eq("user_id", memberUserId);

  revalidatePath("/app/reglages/equipe");
  return { ok: !error };
}
