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
  //
  // Le test sur la destination n'est pas une precaution theorique : si l'etape
  // enregistree est encore ORGANIZATION, sa route est cette page meme, et la
  // rediriger vers elle-meme provoque une boucle infinie que Next transforme en
  // « Application error ». Une page ne se redirige jamais vers elle-meme.
  const destination = activeOrganization ? STEP_ROUTES[activeOrganization.onboarding_step] : null;
  if (destination && destination !== "/onboarding") {
    redirect(destination);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-12">
      <div>
        <p className="text-sm font-medium text-signal">Étape 1 sur 7</p>
        <h1 className="mt-1 text-hero font-semibold">Votre entreprise</h1>
        <p className="mt-2 text-ink-soft">
          Sophie a besoin de savoir pour qui elle répond. Vous pourrez tout modifier ensuite.
        </p>
      </div>
      <OrganizationForm />
    </main>
  );
}
