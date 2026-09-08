import "server-only";

import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import type { MyOrganizationRow, OnboardingStep } from "@/types/database";
import { STEP_ROUTES } from "./steps";
import { ONBOARDING_STEPS } from "@/lib/org/onboarding";

/**
 * Garde d'étape.
 *
 * L'onboarding est reprenable : on peut revenir en arrière librement, mais pas
 * sauter en avant vers une étape dont les données précédentes manquent.
 * L'organisation est la source de vérité, jamais l'URL.
 */
export async function requireStep(step: OnboardingStep): Promise<{
  organization: MyOrganizationRow;
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
}> {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const reached = ONBOARDING_STEPS.indexOf(activeOrganization.onboarding_step);
  const requested = ONBOARDING_STEPS.indexOf(step);

  if (requested > reached) {
    redirect(STEP_ROUTES[activeOrganization.onboarding_step]);
  }

  return { organization: activeOrganization, supabase };
}
