"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caracteres"),
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
    return { error: "Ce compte n'a pas pu être créé. Vérifiez l'adresse e-mail et réessayez." };
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
