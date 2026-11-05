import "server-only";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Garde de l'espace plateforme.
 *
 * `is_platform_admin` est une colonne du profil, pas un rôle d'organisation :
 * les deux chemins d'autorisation restent séparés de bout en bout. Une faille
 * dans l'un ne doit pas ouvrir l'autre (section 37).
 *
 * La lecture passe par le client de session, donc par RLS. Un utilisateur ne
 * peut lire que son propre profil, et il ne peut pas s'y promouvoir : la
 * colonne n'est pas modifiable depuis l'application.
 */
export async function requirePlatformAdmin(): Promise<{
  userId: string;
  email: string | null;
}> {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?suite=/admin");

  const { data: profil } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profil?.is_platform_admin) {
    // Pas de 403 explicite : l'existence de cet espace n'a pas à être
    // confirmée à qui n'y a pas droit.
    redirect("/app");
  }

  return { userId: user.id, email: user.email ?? null };
}
