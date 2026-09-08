import { requireStep } from "../guard";
import { StepShell } from "../step-shell";
import { SkipCalendar } from "./skip-calendar";
import { Sheet } from "@/components/ui/sheet";

export const dynamic = "force-dynamic";
export const metadata = { title: "Votre agenda — Sophie IA" };

/**
 * Étape agenda.
 *
 * La connexion Google Calendar appartient à la Phase 3. Plutôt qu'un faux
 * bouton « Connecter » qui ne connecte rien, cette étape dit la vérité et
 * laisse passer : l'onboarding reste cohérent, et l'étape sera remplie
 * lorsque l'intégration existera réellement.
 */
export default async function CalendarStep() {
  await requireStep("CALENDAR");

  return (
    <StepShell
      step="CALENDAR"
      title="Votre agenda"
      intro="Sophie lira vos vraies disponibilités pour ne jamais proposer un créneau qui n'existe pas."
      backHref="/onboarding/horaires"
    >
      <Sheet className="flex flex-col gap-2 border-attention bg-attention-soft">
        <p className="font-semibold">Connexion Google Calendar à venir</p>
        <p className="text-sm text-ink-soft">
          Cette intégration est en cours de construction. En attendant, Sophie s&apos;appuiera
          uniquement sur les horaires que vous venez de définir.
        </p>
        <p className="text-sm text-ink-soft">
          Vous pourrez connecter votre agenda plus tard depuis les paramètres, sans refaire
          la configuration.
        </p>
      </Sheet>

      <SkipCalendar />
    </StepShell>
  );
}
