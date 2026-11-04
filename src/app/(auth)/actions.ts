"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caracteres"),
});

export interface AuthFormState {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password" | "fullName", string>>;
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Message volontairement identique pour un e-mail inconnu et un mot de
    // passe faux : ne pas reveler quels comptes existent.
    return { error: "E-mail ou mot de passe incorrect." };
  }

  redirect("/");
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const schema = credentials.extend({
    fullName: z.string().min(2, "Indiquez votre prenom et votre nom"),
  });

  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) {
    return {
      error:
        "Ce compte n'a pas pu être créé. Vérifiez l'adresse e-mail et réessayez.",
    };
  }

  redirect("/");
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export interface RecoveryState {
  error?: string;
  success?: string;
}

/**
 * Demande d'un lien de récupération.
 *
 * ## Pourquoi la réponse est la même dans tous les cas
 *
 * Que l'adresse existe ou non, l'écran dit la même chose. Un message qui
 * distingue les deux transforme ce formulaire en annuaire : on y teste des
 * adresses une par une pour savoir lesquelles ont un compte. Le prix à payer
 * est une personne qui attend un e-mail qui n'arrivera pas ; c'est moins grave.
 *
 * ## Où le lien atterrit
 *
 * Supabase renvoie vers `redirect_to` avec un code à échanger. Ce code doit
 * arriver sur `/auth/callback`, seul endroit qui sait l'échanger contre une
 * session. Un lien qui pointe vers la racine du site — ce que fait le bouton
 * du tableau de bord Supabase — dépose la personne sur la page de connexion
 * sans rien faire : c'est exactement ce qui est arrivé le 2026-11-04.
 */
export async function requestPasswordReset(
  _prev: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const parsed = z
    .object({ email: z.string().email("Adresse e-mail invalide") })
    .safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { error: "Adresse e-mail invalide." };
  }

  const supabase = await createServerSupabase();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${APP_URL}/auth/callback?suite=/nouveau-mot-de-passe`,
  });

  return {
    success:
      "Si un compte existe avec cette adresse, un lien vient de partir. " +
      "Il est valable une heure et ne sert qu'une fois.",
  };
}

/**
 * Pose le nouveau mot de passe.
 *
 * Exige une session : elle vient du lien de récupération, échangé par
 * `/auth/callback`. Sans session, on ne sait pas de quel compte il s'agit, et
 * on refuse plutôt que de deviner.
 */
export async function setNewPassword(
  _prev: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const parsed = z
    .object({
      password: z.string().min(8, "Au moins 8 caractères"),
      confirmation: z.string(),
    })
    .safeParse({
      password: formData.get("password"),
      confirmation: formData.get("confirmation"),
    });

  if (!parsed.success) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  if (parsed.data.password !== parsed.data.confirmation) {
    return { error: "Les deux mots de passe ne sont pas identiques." };
  }

  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "Ce lien n'est plus valable. Demandez-en un nouveau depuis la page de connexion.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Le mot de passe n'a pas pu être changé. Réessayez." };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

function fieldErrorsFrom(error: z.ZodError): AuthFormState["fieldErrors"] {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) result[key] = issue.message;
  }
  return result;
}
