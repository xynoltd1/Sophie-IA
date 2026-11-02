import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entreprises — Plateforme" };

/**
 * Les entreprises clientes.
 *
 * Lecture par le client d'administration, parce que le super administrateur
 * n'est membre d'aucune de ces organisations : RLS les lui cacherait toutes.
 * C'est l'un des rares endroits où ce client est légitime, et la garde
 * `requirePlatformAdmin()` est donc la SEULE protection — d'où sa place en
 * première ligne de la fonction.
 *
 * Ce qui est affiché est délibérément limité : nom, métier, état, volumes. Ni
 * contacts, ni appels, ni enregistrements. Exploiter la plateforme ne demande
 * pas de lire les données des clients de ses clients.
 */
export default async function OrganisationsPage() {
  await requirePlatformAdmin();

  const admin = createAdminClient();

  const { data } = await admin
    .from("organizations")
    .select("id, name, country_code, onboarding_step, is_test_organization, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const organisations = (data ?? []) as {
    id: string;
    name: string;
    country_code: string;
    onboarding_step: string;
    is_test_organization: boolean;
    created_at: string;
  }[];

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Entreprises</SectionTitle>

      {organisations.length === 0 ? (
        <EmptyState title="Aucune entreprise" description="Les inscriptions apparaîtront ici." />
      ) : (
        <ul className="flex flex-col gap-2">
          {organisations.map((org) => (
            <li key={org.id}>
              <Sheet className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {org.name}
                    {org.is_test_organization ? (
                      <span className="ml-2 rounded-control bg-attention-soft px-2 py-0.5 text-xs font-normal text-attention">
                        essai
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {org.country_code} · inscrite le{" "}
                    {new Date(org.created_at).toLocaleDateString("fr-BE")}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-ink-soft">
                  {org.onboarding_step === "DONE" ? "Configurée" : "Configuration en cours"}
                </span>
              </Sheet>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
