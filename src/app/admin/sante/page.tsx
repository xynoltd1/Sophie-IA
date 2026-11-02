import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";
import {
  INTEGRATIONS,
  STATUS_LABELS,
  missingEnvFor,
} from "@/lib/providers/status";

export const dynamic = "force-dynamic";

export const metadata = { title: "Santé — Plateforme" };

/** Les noms techniques des purges, en français, pour ne pas lire « CALL_TRASH ». */
const PURGE_LABELS: Record<string, string> = {
  AUDIO: "Enregistrements audio",
  TRANSCRIPT: "Transcriptions",
  SUMMARY: "Résumés et données extraites",
  CALL_EVENT: "Événements d'appel",
  MESSAGE: "Messages et SMS",
  CALL_TRASH: "Corbeille des appels",
};

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

  const [{ data }, { data: purges }] = await Promise.all([
    admin
      .from("provider_errors")
      .select("id, provider, operation, message, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(50),
    admin
      .from("retention_runs")
      .select("id, kind, started_at, finished_at, affected, outcome, detail")
      .order("started_at", { ascending: false })
      .limit(24),
  ]);

  const erreurs = (data ?? []) as {
    id: string;
    provider: string;
    operation: string;
    message: string;
    occurred_at: string;
  }[];

  const executions = (purges ?? []) as {
    id: string;
    kind: string;
    started_at: string;
    finished_at: string | null;
    affected: number;
    outcome: string;
    detail: string | null;
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
        <SectionTitle>Purges de conservation</SectionTitle>
        {executions.length === 0 ? (
          <EmptyState
            title="Aucune purge consignée"
            description="La tâche planifiée n’a pas encore tourné, ou rien n’était arrivé à échéance."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {executions.map((execution) => (
              <li key={execution.id}>
                <Sheet
                  tone={execution.outcome === "ERROR" ? "urgent" : "neutral"}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">
                      {PURGE_LABELS[execution.kind] ?? execution.kind}
                    </p>
                    <span className="shrink-0 text-sm text-ink-soft">
                      {execution.outcome === "ERROR"
                        ? "échec"
                        : `${execution.affected} supprimé${execution.affected === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  {execution.detail ? (
                    <p className="mt-1 text-sm text-ink-soft">
                      {execution.detail}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-ink-faint">
                    {new Date(execution.started_at).toLocaleString("fr-BE", {
                      timeZone: "Europe/Brussels",
                    })}
                    {execution.finished_at === null ? " · jamais terminée" : ""}
                  </p>
                </Sheet>
              </li>
            ))}
          </ul>
        )}
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
