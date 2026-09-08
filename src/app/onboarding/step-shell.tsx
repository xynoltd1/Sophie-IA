import Link from "next/link";
import type { OnboardingStep } from "@/types/database";
import { STEP_NUMBER, TOTAL_STEPS } from "./steps";
import { onboardingProgress } from "@/lib/org/onboarding";

/**
 * Cadre commun aux étapes d'onboarding : numéro, titre, progression.
 * L'artisan doit savoir en permanence où il en est et combien il reste.
 */
export function StepShell({
  step,
  title,
  intro,
  backHref,
  children,
}: {
  step: OnboardingStep;
  title: string;
  intro: string;
  backHref?: string;
  children: React.ReactNode;
}) {
  const progress = onboardingProgress(step);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 py-10">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-signal">
            Étape {STEP_NUMBER[step]} sur {TOTAL_STEPS}
          </p>
          {backHref ? (
            <Link href={backHref} className="text-sm text-ink-soft underline underline-offset-4">
              Retour
            </Link>
          ) : null}
        </div>

        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progression de la configuration"
        >
          <div className="h-full rounded-full bg-signal" style={{ width: `${progress}%` }} />
        </div>

        <h1 className="mt-5 text-hero font-semibold">{title}</h1>
        <p className="mt-2 text-ink-soft">{intro}</p>
      </div>

      {children}
    </main>
  );
}
