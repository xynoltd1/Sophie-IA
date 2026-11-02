import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";
import { INTEGRATIONS, STATUS_LABELS, missingEnvFor } from "@/lib/providers/status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Santé — Plateforme" };

/**
 * Santé du système (section 54).
 *
 * Deux informations côte à côte, et c'est voulu : ce que le registre déclare,
 * et ce que les fournisseurs ont réellement renvoyé ces derniers jours. Quand
 * les deux divergent, c'est le registre qui ment.
 */
export default async function SantePage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("provider_errors")
    .select("id, provider, operation, message, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(50);

  const erreurs = (data ?? []) as {
    id: string;
    provider: string;
    operation: string;
    message: string;
    occurred_at: string;
  }[];

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionTitle>Intégrations</SectionTitle>
        <ul className="flex flex-col gap-2">
          {INTEGRATIONS.map((integration) => {
            const manquantes = missingEnvFor(integration.key);
            return (
              <li key={integration.key}>
                <Sheet className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{integration.label}</p>
                    {manquantes.length > 0 ? (
                      <p className="text-sm text-attention">
                        Variables manquantes : {manquantes.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-sm text-ink-soft">
                    {STATUS_LABELS[integration.status]}
                  </span>
                </Sheet>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <SectionTitle>Erreurs des fournisseurs</SectionTitle>
        {erreurs.length === 0 ? (
          <EmptyState
            title="Aucune erreur consignée"
            description="Les pannes des services externes apparaîtront ici, avec l’heure et l’opération concernée."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {erreurs.map((erreur) => (
              <li key={erreur.id}>
                <Sheet tone="attention">
                  <p className="font-medium">
                    {erreur.provider} · {erreur.operation}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">{erreur.message}</p>
                  <p className="mt-1 text-sm text-ink-faint">
                    {new Date(erreur.occurred_at).toLocaleString("fr-BE", {
                      timeZone: "Europe/Brussels",
                    })}
                  </p>
                </Sheet>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
