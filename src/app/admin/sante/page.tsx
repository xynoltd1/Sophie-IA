import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { Carte, Tableau, TitreSection } from "@/components/admin/surface";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import {
  LIBELLES_ETAT,
  TONS_ETAT,
  quand,
  santeIntegrations,
} from "@/lib/platform/health";

export const dynamic = "force-dynamic";
export const metadata = { title: "Santé du système — Plateforme" };

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
 * L'écran précédent affichait « Testé en conditions réelles » à côté de
 * « Variables manquantes ». Les deux affirmations étaient exactes et
 * contradictoires : l'une venait du code, l'autre de l'environnement. Un seul
 * mot portait trois questions.
 *
 * Elles sont désormais séparées, et c'est **le présent qui décide** de l'état
 * affiché : une intégration mal configurée est hors service, quel que soit son
 * passé. Le dernier test réussi reste visible, comme information de contexte,
 * jamais comme preuve que ça marche aujourd'hui.
 */
export default async function SantePage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const [integrations, erreursRes, purgesRes] = await Promise.all([
    santeIntegrations(),
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

  const erreurs = (erreursRes.data ?? []) as {
    id: string;
    provider: string;
    operation: string;
    message: string;
    occurred_at: string;
  }[];

  const purges = (purgesRes.data ?? []) as {
    id: string;
    kind: string;
    started_at: string;
    finished_at: string | null;
    affected: number;
    outcome: string;
    detail: string | null;
  }[];

  const enPanne = integrations.filter((i) => i.etat === "EN_PANNE").length;
  const aConfigurer = integrations.filter(
    (i) => i.etat === "NON_CONFIGURE",
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Santé du système
      </h1>

      <Carte>
        <p className="text-sm leading-relaxed text-ink-soft">
          {enPanne > 0
            ? `${enPanne} intégration${enPanne > 1 ? "s" : ""} en panne. `
            : "Aucune intégration en panne. "}
          {aConfigurer > 0
            ? `${aConfigurer} attend${aConfigurer > 1 ? "ent" : ""} une clé ou un compte.`
            : "Toutes sont configurées."}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-faint">
          Un test réussi le mois dernier ne prouve rien sur aujourd’hui. L’état
          affiché est celui du présent : configuration lue maintenant, dernier
          échange réel lu en base. Le passé est écrit à côté, jamais à la place.
        </p>
      </Carte>

      <section>
        <TitreSection>Intégrations</TitreSection>
        <ul className="flex flex-col gap-3">
          {integrations.map((integration) => (
            <li key={integration.cle}>
              <Carte>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="font-medium">{integration.libelle}</p>
                  <Badge ton={TONS_ETAT[integration.etat]}>
                    {LIBELLES_ETAT[integration.etat]}
                  </Badge>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-ink-faint">Configuration</dt>
                    <dd
                      className={
                        integration.variablesManquantes.length > 0
                          ? "text-attention"
                          : ""
                      }
                    >
                      {integration.variablesManquantes.length === 0
                        ? "complète"
                        : `manquant : ${integration.variablesManquantes.join(", ")}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Dernier échange réussi</dt>
                    <dd className="tabular">
                      {quand(integration.dernierSucces)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Dernier échec</dt>
                    <dd className="tabular">
                      {quand(integration.dernierEchec)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">Erreurs sur 7 jours</dt>
                    <dd className="tabular">{integration.erreursRecentes}</dd>
                  </div>
                </dl>

                {integration.dernierDetail ? (
                  <p className="mt-3 rounded-control bg-urgent-soft px-3 py-2 text-sm">
                    {integration.dernierDetail}
                  </p>
                ) : null}

                <p className="mt-3 text-sm text-ink-soft">
                  <span className="font-medium text-ink">À faire : </span>
                  {integration.action}
                </p>

                {/* Depuis la supervision, on rejoint la configuration en un
                    clic. Un écran qui signale un problème sans mener à l'endroit
                    où le corriger oblige à chercher. */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/admin/integrations"
                    className="flex min-h-11 items-center rounded-control border border-line bg-surface px-3 text-sm font-medium"
                  >
                    Configurer
                  </Link>
                  {integration.testable ? (
                    <Link
                      href="/admin/integrations"
                      className="flex min-h-11 items-center rounded-control border border-line bg-surface px-3 text-sm font-medium"
                    >
                      Tester la connexion
                    </Link>
                  ) : null}
                </div>

                {integration.codeNote ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-ink-faint">
                      Ce que le code fait
                    </summary>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                      {integration.codeNote}
                    </p>
                  </details>
                ) : null}
              </Carte>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <TitreSection detail="Elles tournent chaque nuit. Une purge sans trace ne peut ni se prouver ni se diagnostiquer.">
          Purges de conservation
        </TitreSection>
        {purges.length === 0 ? (
          <EmptyState
            title="Aucune purge consignée"
            description="La tâche planifiée n’a pas encore tourné, ou CRON_SECRET manque sur Vercel. Vérifiez Vercel → Cron Jobs."
          />
        ) : (
          <Tableau entetes={["Purge", "Quand", "Supprimés", "Issue"]}>
            {purges.map((purge) => (
              <tr key={purge.id}>
                <td className="px-4 py-3 font-medium">
                  {PURGE_LABELS[purge.kind] ?? purge.kind}
                </td>
                <td className="tabular px-4 py-3 text-ink-soft">
                  {new Date(purge.started_at).toLocaleString("fr-BE", {
                    timeZone: "Europe/Brussels",
                  })}
                </td>
                <td className="tabular px-4 py-3">{purge.affected}</td>
                <td className="px-4 py-3">
                  {purge.outcome === "ERROR" ? (
                    <Badge ton="urgent">échec</Badge>
                  ) : purge.finished_at === null ? (
                    <Badge ton="attention">jamais terminée</Badge>
                  ) : (
                    <Badge ton="neutre">ok</Badge>
                  )}
                  {purge.detail ? (
                    <span className="ml-2 text-ink-soft">{purge.detail}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </Tableau>
        )}
      </section>

      <section>
        <TitreSection>Erreurs des fournisseurs</TitreSection>
        {erreurs.length === 0 ? (
          <EmptyState
            title="Aucune erreur consignée"
            description="Les pannes des services externes apparaîtront ici, avec l’heure et l’opération concernée."
          />
        ) : (
          <Tableau entetes={["Fournisseur", "Opération", "Message", "Quand"]}>
            {erreurs.map((erreur) => (
              <tr key={erreur.id}>
                <td className="px-4 py-3 font-medium">{erreur.provider}</td>
                <td className="px-4 py-3 text-ink-soft">{erreur.operation}</td>
                <td className="px-4 py-3 text-ink-soft">{erreur.message}</td>
                <td className="tabular px-4 py-3 text-ink-faint">
                  {new Date(erreur.occurred_at).toLocaleString("fr-BE", {
                    timeZone: "Europe/Brussels",
                  })}
                </td>
              </tr>
            ))}
          </Tableau>
        )}
      </section>
    </div>
  );
}
