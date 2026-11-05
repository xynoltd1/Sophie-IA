"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createServerSupabase } from "@/lib/supabase/server";
import { journaliserAdmin } from "@/lib/platform/audit";

export interface CompteState {
  error?: string;
  success?: string;
}

/**
 * Changer son nom.
 *
 * Le nom vit à deux endroits : `profiles.full_name`, que l'application lit
 * partout, et les métadonnées du compte d'authentification, que l'écran
 * d'accueil utilise pour dire « Bonjour Zehra ». Les deux ont déjà divergé une
 * fois — un compte affichait un prénom et le profil un autre. On écrit donc
 * les deux, dans la même action.
 */
export async function changerNom(
  _prev: CompteState,
  formData: FormData,
): Promise<CompteState> {
  const parsed = z
    .object({ nom: z.string().trim().min(2, "Indiquez un nom").max(120) })
    .safeParse({ nom: formData.get("nom") });

  if (!parsed.success)
    return { error: "Indiquez un nom d’au moins deux caractères." };

  const { userId } = await requirePlatformAdmin();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.nom })
    .eq("id", userId);

  if (error) return { error: "Le nom n’a pas pu être enregistré." };

  await supabase.auth.updateUser({ data: { full_name: parsed.data.nom } });
  await journaliserAdmin({
    actorUserId: userId,
    action: "profile.rename",
    resourceType: "profiles",
    resourceId: userId,
  });

  revalidatePath("/admin/parametres");
  revalidatePath("/admin");
  return { success: "Nom enregistré." };
}

/**
 * Changer son mot de passe.
 *
 * L'ancien mot de passe est redemandé et **vérifié** avant le changement.
 * Supabase ne l'exige pas : une session valide suffit à son API. Mais une
 * session valide, c'est un écran resté ouvert dans un bureau — et ce compte-ci
 * ouvre les données de toutes les entreprises. La réauthentification coûte
 * quinze secondes et ferme ce chemin.
 */
export async function changerMotDePasse(
  _prev: CompteState,
  formData: FormData,
): Promise<CompteState> {
  const parsed = z
    .object({
      actuel: z.string().min(1),
      nouveau: z.string().min(8),
      confirmation: z.string().min(8),
    })
    .safeParse({
      actuel: formData.get("actuel"),
      nouveau: formData.get("nouveau"),
      confirmation: formData.get("confirmation"),
    });

  if (!parsed.success) {
    return {
      error: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
    };
  }

  if (parsed.data.nouveau !== parsed.data.confirmation) {
    return { error: "Les deux nouveaux mots de passe ne sont pas identiques." };
  }

  const { email, userId } = await requirePlatformAdmin();
  if (!email) return { error: "Ce compte n’a pas d’adresse e-mail." };

  const supabase = await createServerSupabase();

  const { error: verification } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.actuel,
  });

  if (verification) return { error: "Le mot de passe actuel est incorrect." };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.nouveau,
  });
  if (error) return { error: "Le mot de passe n’a pas pu être changé." };

  await journaliserAdmin({
    actorUserId: userId,
    action: "profile.password",
    resourceType: "auth.users",
    resourceId: userId,
  });

  return { success: "Mot de passe changé." };
}
