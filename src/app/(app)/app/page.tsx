import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { Row, RowGroup } from "@/components/ui/rows";
import { StatStrip } from "@/components/ui/stat";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { onboardingProgress } from "@/lib/org/onboarding";
import {
  activiteZeli,
  etatLigneZeli,
  getDashboardCounts,
  getTodayAppointments,
} from "@/lib/crm/queries";
import { MESSAGE_SILENCE } from "@/lib/sophie/ligne";
import {
  APPOINTMENT_STATUS_LABELS,
  formatTime,
  needsApproval,
} from "@/lib/crm/agenda";
import { STEP_ROUTES } from "@/app/onboarding/steps";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accueil — Zelicall" };

/**
 * Écran d'accueil (section 30).
 *
 * La question est : « qu'est-ce qui demande mon attention maintenant ? »
 *
 * ## Pourquoi cette hiérarchie
 *
 * La première version empilait six cartes ambre identiques : une urgence, un
 * rendez-vous à valider, des appels sans suite, des prospects, des tâches. Six
 * signaux de même poids ne font pas six priorités, ils font un mur — et un mur
 * se saute. Quand tout crie, rien ne s'entend.
 *
 * Trois niveaux, donc :
 *
 * 1. **Ce qui ne peut pas attendre** garde une carte à lui, avec l'arête de
 *    couleur. Il doit être la seule chose colorée de l'écran.
 * 2. **Ce qui attend aujourd'hui** tient dans une seule surface, une ligne par
 *    sujet, le nombre en tête. On compare cinq nombres alignés ; on ne compare
 *    pas cinq cartes.
 * 3. **Ce qui s'est passé** est un relevé en bas de page, consultable, jamais
 *    réclamant.
 *
 * L'heure mène la journée. Un artisan ne lit pas son agenda par intitulé, il
 * le lit par heure : « 8 h chez Dupont, 11 h chez Martin ». L'heure est donc
 * la première colonne, en chasse tabulaire, et non une mention secondaire
 * derrière le titre.
 */
export default async function HomePage() {
  const { activeOrganization, user } = await requireOrganization();
  const progress = onboardingProgress(activeOrganization.onboarding_step);
  const configured = activeOrganization.onboarding_step === "DONE";

  const [{ counts, error: countsError }, rendezVous, ligne, activite] =
    await Promise.all([
      getDashboardCounts(activeOrganization.organization_id),
      getTodayAppointments(activeOrganization.organization_id),
      etatLigneZeli(activeOrganization.organization_id),
      activiteZeli(activeOrganization.organization_id),
    ]);

  const firstName = (
    user.user_metadata?.full_name as string | undefined
  )?.split(" ")[0];

  // Ce qui ne peut pas attendre : une urgence réelle, et rien d'autre.
  const urgences = counts.urgent_leads;

  // Ce qui attend aujourd'hui, dans l'ordre où on s'en occupe : décider,
  // rappeler, qualifier, rattraper.
  const attentes = [
    counts.pending_appointments > 0
      ? {
          href: "/app/agenda",
          compte: counts.pending_appointments,
          titre: `Rendez-vous à valider`,
          detail:
            "Zeli les a pris provisoirement. Ils attendent votre accord.",
        }
      : null,
    counts.calls_no_followup > 0
      ? {
          href: "/app/appels?filtre=sans-suite",
          compte: counts.calls_no_followup,
          titre:
            counts.calls_no_followup > 1
              ? "Appels à rappeler"
              : "Appel à rappeler",
          detail: "Ni demande ni rendez-vous à la fin de l'appel.",
        }
      : null,
    counts.calls_failed > 0
      ? {
          href: "/app/appels?filtre=echoues",
          compte: counts.calls_failed,
          titre: "Appels que Zeli n'a pas pu prendre",
          detail: "Le client a entendu sonner sans réponse.",
        }
      : null,
    counts.new_leads > 0
      ? {
          href: "/app/prospects?filtre=nouveau",
          compte: counts.new_leads,
          titre:
            counts.new_leads > 1 ? "Nouveaux prospects" : "Nouveau prospect",
          detail: "À qualifier avant de les perdre.",
        }
      : null,
    counts.overdue_tasks > 0
      ? {
          href: "/app/taches?vue=retard",
          compte: counts.overdue_tasks,
          titre:
            counts.overdue_tasks > 1 ? "Tâches en retard" : "Tâche en retard",
        }
      : null,
  ].filter((entree): entree is NonNullable<typeof entree> => entree !== null);

  const rienNAttend = urgences === 0 && attentes.length === 0;

  return (
    <div className="flex flex-col gap-7">
      <header>
        <h1 className="text-hero font-semibold">
          {firstName ? `Bonjour ${firstName}` : "Bonjour"}
        </h1>
        <p className="mt-1 text-ink-soft">
          {!configured
            ? "Zeli n'est pas encore prête à répondre à vos appels."
            : ligne.repond
              ? `Zeli répond sur le ${ligne.numero}.`
              : ligne.raison
                ? MESSAGE_SILENCE[ligne.raison].titre
                : "Zeli ne répond pas pour le moment."}
        </p>
      </header>

      {!configured ? (
        <Sheet tone="attention">
          <p className="font-display text-lg font-semibold">
            Configuration de Zeli
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {progress} % de la configuration est fait. Il reste votre métier,
            vos services, vos horaires, votre agenda et vos règles d’appel.
          </p>
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression de la configuration"
          >
            <div
              className="h-full rounded-full bg-attention"
              style={{ width: `${progress}%` }}
            />
          </div>
          <Link
            href={STEP_ROUTES[activeOrganization.onboarding_step]}
            className="pressable mt-4 flex min-h-12 items-center justify-center rounded-control bg-attention px-4 font-medium text-white"
          >
            Reprendre la configuration
          </Link>
        </Sheet>
      ) : null}

      {configured && ligne.raison ? (
        <Sheet tone="attention">
          <p className="font-display text-lg font-semibold">
            {MESSAGE_SILENCE[ligne.raison].titre}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {MESSAGE_SILENCE[ligne.raison].detail}
          </p>
          <Link
            href={
              ligne.raison === "AUCUN_NUMERO"
                ? "/app/sophie/ligne"
                : "/app/sophie"
            }
            className="mt-3 inline-block text-sm font-medium text-signal underline underline-offset-4"
          >
            {ligne.raison === "AUCUN_NUMERO"
              ? "Déclarer mon numéro"
              : "Ouvrir les réglages de Zeli"}
          </Link>
        </Sheet>
      ) : null}

      <section>
        <SectionTitle>Ce qui presse</SectionTitle>

        {countsError ? (
          <ErrorState description="Les compteurs n'ont pas pu être chargés. Rechargez la page." />
        ) : rienNAttend ? (
          <EmptyState
            title="Rien ne vous attend"
            description={
              counts.open_leads > 0
                ? `Vos ${counts.open_leads} prospect${counts.open_leads > 1 ? "s" : ""} en cours n'attendent rien de vous dans l'immédiat.`
                : "Les urgences, les nouveaux prospects et les tâches en retard apparaîtront ici."
            }
            action={
              counts.open_leads > 0 ? (
                <Link
                  href="/app/prospects"
                  className="font-medium text-signal underline underline-offset-4"
                >
                  Voir les prospects
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {urgences > 0 ? (
              <Link href="/app/prospects?filtre=urgent" className="block">
                <Sheet
                  interactive
                  tone="urgent"
                  className="flex items-center gap-3.5"
                >
                  <span
                    aria-hidden
                    className="tabular min-w-9 text-center text-stat font-semibold text-urgent"
                  >
                    {urgences}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {urgences > 1 ? "Urgences" : "Urgence"}
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug text-ink-soft">
                      À traiter avant tout le reste.
                    </span>
                  </span>
                  <span aria-hidden className="shrink-0 text-ink-soft">
                    →
                  </span>
                </Sheet>
              </Link>
            ) : null}

            {attentes.length > 0 ? (
              <RowGroup>
                {attentes.map((entree) => (
                  <Row
                    key={entree.href}
                    href={entree.href}
                    compte={entree.compte}
                    titre={entree.titre}
                    detail={"detail" in entree ? entree.detail : undefined}
                    ton="attention"
                  />
                ))}
              </RowGroup>
            ) : null}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Aujourd’hui</SectionTitle>
        {rendezVous.length === 0 ? (
          <EmptyState
            title="Aucun rendez-vous"
            description="Vos interventions du jour apparaîtront ici."
            action={
              <Link
                href="/app/agenda"
                className="font-medium text-signal underline underline-offset-4"
              >
                Ouvrir l’agenda
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {rendezVous.map((rdv) => (
              <li key={rdv.id}>
                <Link href="/app/agenda" className="block">
                  <Sheet
                    interactive
                    tone={needsApproval(rdv.status) ? "attention" : "neutral"}
                    className="flex items-start gap-3.5"
                  >
                    <span className="tabular shrink-0 pt-0.5 text-lg font-semibold leading-tight text-ink">
                      {formatTime(rdv.starts_at)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{rdv.title}</span>
                      <span className="mt-0.5 block text-sm leading-snug text-ink-soft">
                        jusqu’à {formatTime(rdv.ends_at)}
                        {rdv.contact_name ? ` · ${rdv.contact_name}` : ""}
                      </span>
                    </span>
                    {needsApproval(rdv.status) ? (
                      <span className="shrink-0 text-sm font-medium text-attention">
                        {APPOINTMENT_STATUS_LABELS[rdv.status]}
                      </span>
                    ) : null}
                  </Sheet>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Zeli, ces sept jours</SectionTitle>
        <StatStrip
          items={[
            {
              valeur: activite.appels,
              label: "appels pris",
              href: "/app/appels",
            },
            {
              valeur: activite.prospects,
              label: "prospects",
              href: "/app/prospects",
            },
            {
              valeur: activite.rendezVous,
              label: "rendez-vous",
              href: "/app/agenda",
            },
          ]}
        />
      </section>
    </div>
  );
}
