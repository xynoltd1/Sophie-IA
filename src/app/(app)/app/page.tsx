import { requireOrganization } from "@/lib/auth/session";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { onboardingProgress } from "@/lib/org/onboarding";
import { getDashboardCounts } from "@/lib/crm/queries";
import Link from "next/link";
import { STEP_ROUTES } from "@/app/onboarding/steps";

export const metadata = { title: "Accueil — Sophie IA" };

/**
 * Ecran d’accueil (section 30).
 * La question a laquelle il repond : « qu’est-ce qui demande mon attention
 * maintenant ? » En Phase 0, la seule reponse honnete est : finir la
 * configuration. Les blocs A traiter / Aujourd’hui / Activite Sophie arrivent
 * en Phases 2, 3 et 5.
 */
export default async function HomePage() {
  const { activeOrganization, user } = await requireOrganization();
  const progress = onboardingProgress(activeOrganization.onboarding_step);
  const configured = activeOrganization.onboarding_step === "DONE";
  const { counts, error: countsError } = await getDashboardCounts(
    activeOrganization.organization_id,
  );
  const aTraiter = counts.urgent_leads + counts.new_leads + counts.overdue_tasks;
  const firstName = (user.user_metadata?.full_name as string | undefined)?.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-hero font-semibold">
          {firstName ? `Bonjour ${firstName}` : "Bonjour"}
        </h1>
        <p className="mt-1 text-ink-soft">
          {configured
            ? "Votre configuration est terminée. Sophie décrochera dès que la téléphonie sera active."
            : "Sophie n’est pas encore prête à répondre à vos appels."}
        </p>
      </section>

      {!configured ? (
      <Sheet tone="attention">
        <p className="font-display text-lg font-semibold">Configuration de Sophie</p>
        <p className="mt-1 text-sm text-ink-soft">
          {progress} % de la configuration est fait. Il reste votre métier, vos services,
          vos horaires, votre agenda et vos règles d’appel.
        </p>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progression de la configuration"
        >
          <div className="h-full rounded-full bg-attention" style={{ width: `${progress}%` }} />
        </div>
        <Link
          href={STEP_ROUTES[activeOrganization.onboarding_step]}
          className="mt-4 flex min-h-12 items-center justify-center rounded-control bg-attention px-4 font-medium text-white"
        >
          Reprendre la configuration
        </Link>
      </Sheet>
      ) : null}

      <section>
        <SectionTitle>À traiter</SectionTitle>
        {countsError ? (
          <ErrorState description="Les compteurs n’ont pas pu être chargés. Rechargez la page." />
        ) : aTraiter === 0 ? (
          <EmptyState
            title="Rien ne vous attend"
            description="Les urgences, les prospects à qualifier et les tâches en retard apparaîtront ici."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {counts.urgent_leads > 0 ? (
              <li>
                <Link href="/app/prospects?filtre=urgent" className="block">
                  <Sheet tone="urgent" className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      {counts.urgent_leads} urgence{counts.urgent_leads > 1 ? "s" : ""}
                    </span>
                    <span aria-hidden className="text-ink-soft">→</span>
                  </Sheet>
                </Link>
              </li>
            ) : null}
            {counts.new_leads > 0 ? (
              <li>
                <Link href="/app/prospects?filtre=nouveau" className="block">
                  <Sheet tone="attention" className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      {counts.new_leads} nouveau{counts.new_leads > 1 ? "x" : ""} prospect
                      {counts.new_leads > 1 ? "s" : ""} à qualifier
                    </span>
                    <span aria-hidden className="text-ink-soft">→</span>
                  </Sheet>
                </Link>
              </li>
            ) : null}
            {counts.overdue_tasks > 0 ? (
              <li>
                <Link href="/app/prospects?filtre=retard" className="block">
                  <Sheet tone="attention" className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      {counts.overdue_tasks} tâche{counts.overdue_tasks > 1 ? "s" : ""} en retard
                    </span>
                    <span aria-hidden className="text-ink-soft">→</span>
                  </Sheet>
                </Link>
              </li>
            ) : null}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Aujourd’hui</SectionTitle>
        <EmptyState
          title="Aucun rendez-vous"
          description="Connectez votre agenda Google pour voir vos interventions du jour."
          action={
            <Link href="/app/plus" className="font-medium text-signal underline underline-offset-4">
              Voir les paramètres
            </Link>
          }
        />
      </section>
    </div>
  );
}
