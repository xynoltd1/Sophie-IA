"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth/session";

const schema = z.object({
  name: z.string().trim().min(2, "Indiquez le nom de votre entreprise").max(120),
  countryCode: z.string().regex(/^[A-Z]{2}$/, "Pays invalide"),
  timezone: z.string().min(3),
});

const COUNTRIES: Record<string, { callingCode: string; timezone: string; label: string }> = {
  BE: { callingCode: "32", timezone: "Europe/Brussels", label: "Belgique" },
  FR: { callingCode: "33", timezone: "Europe/Paris", label: "France" },
};

// Le lancement est limite a la France et a la Belgique : les obligations
// applicables a l'enregistrement des appels y sont documentees et verifiees
// (voir docs/SECURITY.md). Ajouter un pays est une decision juridique avant
// d'etre une ligne de code.

export const SUPPORTED_COUNTRIES = COUNTRIES;

export interface OnboardingState {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "countryCode", string>>;
}

export async function createOrganization(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const countryCode = String(formData.get("countryCode") ?? "BE");
  const country = COUNTRIES[countryCode];

  if (!country) {
    return { fieldErrors: { countryCode: "Ce pays n'est pas encore pris en charge." } };
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    countryCode,
    timezone: country.timezone,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { fieldErrors: { name: first?.message ?? "Formulaire invalide" } };
  }

  const supabase = await createServerSupabase();

  // La creation passe par une fonction SQL : elle cree l'organisation, le
  // membre OWNER et l'activite associee dans une seule transaction.
  const { data, error } = await supabase.rpc("create_organization", {
    org_name: parsed.data.name,
    org_country_code: parsed.data.countryCode,
    org_country_calling_code: country.callingCode,
    org_timezone: country.timezone,
    org_locale: "fr",
  });

  if (error || !data) {
    return {
      error:
        "L'entreprise n'a pas pu etre creee. Reessayez dans un instant ; si le probleme persiste, contactez le support.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, String(data), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // L'organisation existe : on enchaîne sur le métier.
  await supabase.rpc("set_onboarding_step", {
    org_id: String(data),
    step: "PROFESSION",
  });

  redirect("/onboarding/metier");
}
