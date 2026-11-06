import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Les offres montrées sur la page publique.
 *
 * ## Pourquoi un prix peut manquer
 *
 * `monthly_price_cents` vaut `null` tant que le tarif n'est pas fixé. Ce n'est
 * pas une donnée absente par erreur : le cahier des charges interdit
 * d'inventer un prix, et la colonne le dit. La page affiche alors « Tarif à
 * venir », ce qui est vrai, plutôt qu'un nombre qu'il faudrait démentir.
 *
 * ## Pourquoi `is_public`
 *
 * Une offre existe en base bien avant d'être commercialisable. Seules celles
 * que la console a explicitement rendues publiques sortent ici. Par défaut,
 * aucune : la section d'accès s'affiche alors sous sa forme « création de
 * compte », sans grille tarifaire.
 *
 * ## Pourquoi le client d'administration
 *
 * La page est publique, donc sans session. Les offres publiques ne sont
 * secrètes pour personne, et la requête ne lit que des colonnes de catalogue.
 */

export interface OffrePublique {
  code: string;
  label: string;
  description: string | null;
  /** Déjà formaté, ou null quand le tarif n'est pas fixé. */
  prix: string | null;
  minutes: number;
  sms: number;
  membres: number | null;
}

export async function offresPubliques(): Promise<OffrePublique[]> {
  try {
    const admin = createAdminClient();

    const { data } = await admin
      .from("plans")
      .select(
        "code, label, description, monthly_price_cents, currency, included_voice_minutes, included_sms, max_members",
      )
      .eq("is_public", true)
      .order("sort_order", { ascending: true });

    return (data ?? []).map((plan) => ({
      code: plan.code as string,
      label: plan.label as string,
      description: (plan.description as string | null) ?? null,
      prix:
        typeof plan.monthly_price_cents === "number"
          ? new Intl.NumberFormat("fr-BE", {
              style: "currency",
              currency: (plan.currency as string) || "EUR",
              maximumFractionDigits: 0,
            }).format(plan.monthly_price_cents / 100) + " / mois"
          : null,
      minutes: (plan.included_voice_minutes as number) ?? 0,
      sms: (plan.included_sms as number) ?? 0,
      membres: (plan.max_members as number | null) ?? null,
    }));
  } catch {
    // Base injoignable : la page sort avec sa section « création de compte »
    // plutôt que de ne pas sortir du tout.
    return [];
  }
}
