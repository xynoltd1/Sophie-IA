import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { OrganizationForm } from "./organization-form";
import { STEP_ROUTES } from "./steps";

/**
 * Rendu dynamique obligatoire : cette page dépend de la session de
 * l'utilisateur. Sans cette directive, Next tente de la prérendre au moment du
 * build, où aucune session ni aucune variable d'environnement n'existe.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Votre entreprise — Sophie IA" };

export default async function OnboardingPage() {
  const { activeOrganization } = await requireSession();

  // L'entreprise existe déjà : on reprend l'onboarding là où il s'est arrêté.
  if (activeOrganization) {
    redirect(STEP_ROUTES[activeOrganization.onboarding_step]);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-12">
      <div>
        <p className="text-sm font-medium text-signal">Etape 1 sur 7</p>
        <h1 className="mt-1 text-hero font-semibold">Votre entreprise</h1>
        <p className="mt-2 text-ink-soft">
          Sophie a besoin de savoir pour qui elle repond. Vous pourrez tout modifier ensuite.
        </p>
      </div>
      <OrganizationForm />
    </main>
  );
}
