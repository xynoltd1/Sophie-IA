import Link from "next/link";
import { requireStep } from "../guard";
import { StepShell } from "../step-shell";
import { SkipCalendar } from "./skip-calendar";
import { Sheet } from "@/components/ui/sheet";
import { getCalendarState } from "@/lib/crm/calendar-state";
import { googleCalendarConfigured } from "@/lib/providers/calendar/google";

export const dynamic = "force-dynamic";
export const metadata = { title: "Votre agenda — Sophie IA" };

/**
 * Étape agenda.
 *
 * Trois situations, et l'écran dit laquelle s'applique plutôt que d'afficher un
 * bouton qui ne ferait rien :
 *  - agenda déjà connecté ;
 *  - connexion possible ;
 *  - identifiants Google absents de cette installation.
 */
export default async function CalendarStep() {
  const { organization } = await requireStep("CALENDAR");
  const state = await getCalendarState(organization.organization_id);
  const configured = googleCalendarConfigured();

  return (
    <StepShell
      step="CALENDAR"
      title="Votre agenda"
      intro="Sophie lira vos vraies disponibilités pour ne jamais proposer un créneau qui n'existe pas."
      backHref="/onboarding/horaires"
    >
      {state.connected ? (
        <Sheet tone="done" className="flex flex-col gap-1">
          <p className="font-medium">Agenda connecté</p>
          {state.account ? <p className="text-sm text-ink-soft">{state.account}</p> : null}
          <p className="text-sm text-ink-soft">
            Sophie tiendra compte de vos rendez-vous personnels.
          </p>
        </Sheet>
      ) : configured ? (
        <Sheet className="flex flex-col gap-3">
          <p className="font-medium">Connecter Google Calendar</p>
          <p className="text-sm text-ink-soft">
            Sophie lira vos plages occupées pour ne pas proposer un créneau déjà pris. Elle
            ne lit que les horaires de vos événements, jamais leur contenu, et elle
            n&apos;accède qu&apos;à votre agenda — pas à vos e-mails ni à vos contacts.
          </p>
          <a
            href="/api/integrations/google/start"
            className="flex min-h-12 items-center justify-center rounded-control bg-signal px-4 font-medium text-white"
          >
            Connecter mon agenda Google
          </a>
        </Sheet>
      ) : (
        <Sheet tone="attention" className="flex flex-col gap-2">
          <p className="font-semibold">Connexion Google pas encore disponible</p>
          <p className="text-sm text-ink-soft">
            Cette installation n&apos;a pas encore ses identifiants Google. Vous pourrez
            connecter votre agenda depuis les paramètres dès qu&apos;ils seront en place,
            sans refaire la configuration.
          </p>
          <p className="text-sm text-ink-soft">
            En attendant, Sophie s&apos;appuiera uniquement sur les horaires que vous venez
            de définir.
          </p>
        </Sheet>
      )}

      <SkipCalendar connected={state.connected} />

      {state.connected ? null : (
        <p className="text-sm text-ink-faint">
          Vous pourrez toujours le connecter plus tard depuis{" "}
          <Link href="/app/plus" className="underline underline-offset-4">
            les paramètres
          </Link>
          .
        </p>
      )}
    </StepShell>
  );
}
