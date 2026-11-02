import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/states";
import { can } from "@/lib/auth/permissions";
import { missingEnvFor } from "@/lib/providers/status";
import { LigneEditor, type LignePhone } from "./editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ligne téléphonique — Sophie IA" };

/**
 * La ligne téléphonique de Sophie.
 *
 * Cet écran manquait, et c'était le blocage le plus coûteux du produit : sans
 * numéro déclaré, tout appel tombe dans le repli « essai », donc rien ne peut
 * être vérifié de bout en bout.
 *
 * Ce qu'il ne fait pas, et le dit : commander un numéro, l'activer chez
 * l'opérateur, vérifier qu'il existe. Déclarer une ligne enregistre un lien
 * entre un numéro et une entreprise, rien de plus.
 */
export default async function LignePage() {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const [lignesRes, orgRes] = await Promise.all([
    supabase
      .from("phone_numbers")
      .select(
        "id, e164, public_number, label, connection_mode, is_test, is_active, provider, last_error, verified_at",
      )
      .eq("organization_id", activeOrganization.organization_id)
      .order("created_at"),
    supabase
      .from("organizations")
      .select("country_code")
      .eq("id", activeOrganization.organization_id)
      .maybeSingle(),
  ]);

  const manquantes = missingEnvFor("voice");

  return (
    <div className="flex flex-col gap-5">
      <Link href="/app/sophie" className="text-sm text-ink-soft underline underline-offset-4">
        ← Sophie
      </Link>
      <SectionTitle>Ligne téléphonique</SectionTitle>

      {lignesRes.error ? (
        <ErrorState description="Vos lignes n’ont pas pu être chargées." />
      ) : (
        <>
          {(lignesRes.data ?? []).length === 0 ? (
            <Sheet tone="attention">
              <p className="font-medium">Aucune ligne déclarée</p>
              <p className="mt-1 text-sm text-ink-soft">
                Tant qu’aucun numéro n’est rattaché à votre entreprise, Sophie ne peut pas
                savoir à qui appartient un appel entrant. Tous les appels sont alors marqués
                « essai » et n’apparaissent dans aucune alerte.
              </p>
            </Sheet>
          ) : null}

          <LigneEditor
            lignes={(lignesRes.data ?? []) as LignePhone[]}
            pays={(orgRes.data?.country_code as string | undefined) ?? "BE"}
            peutGerer={can(activeOrganization.role, "organization:update")}
            fournisseurConfigure={manquantes.length === 0}
          />
        </>
      )}
    </div>
  );
}
