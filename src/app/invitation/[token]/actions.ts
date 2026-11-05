"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ResultatInvitation =
  | "OK"
  | "INTROUVABLE"
  | "EXPIREE"
  | "DEJA_ACCEPTEE"
  | "AUTRE_ADRESSE"
  | "ECHEC";

/**
 * Rejoindre une entreprise sur invitation.
 *
 * Le client d'administration est nécessaire ici, et c'est l'un des rares
 * endroits où il l'est : la personne n'est pas encore membre, donc RLS lui
 * cache l'invitation qui la concerne. Les contrôles sont donc faits
 * explicitement, un par un, et dans l'ordre.
 *
 * Le contrôle qui compte est le dernier : l'adresse du compte connecté doit
 * être celle de l'invitation. Sans lui, un lien transféré ferait entrer
 * n'importe qui.
 */
export async function accepterInvitation(
  jeton: string,
): Promise<ResultatInvitation> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?suite=/invitation/${jeton}`);

  const admin = createAdminClient();
  const empreinte = createHash("sha256").update(jeton).digest("hex");

  const { data: invitation } = await admin
    .from("organization_invitations")
    .select(
      "id, organization_id, email, role, expires_at, accepted_at, revoked_at",
    )
    .eq("token_hash", empreinte)
    .maybeSingle();

  if (!invitation || invitation.revoked_at) return "INTROUVABLE";
  if (invitation.accepted_at) return "DEJA_ACCEPTEE";
  if (new Date(invitation.expires_at as string).getTime() < Date.now())
    return "EXPIREE";

  const attendue = (invitation.email as string).trim().toLowerCase();
  const connecte = (user.email ?? "").trim().toLowerCase();
  if (!connecte || connecte !== attendue) return "AUTRE_ADRESSE";

  const { error: adhesion } = await admin.from("organization_members").insert({
    organization_id: invitation.organization_id,
    user_id: user.id,
    role: invitation.role,
    status: "ACTIVE",
  });

  // Une adhésion déjà existante n'est pas une erreur : l'invitation est
  // simplement caduque, et la personne est déjà dans l'entreprise.
  if (adhesion && adhesion.code !== "23505") return "ECHEC";

  await admin
    .from("organization_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return "OK";
}
