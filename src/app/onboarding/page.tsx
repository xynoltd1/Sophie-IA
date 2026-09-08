import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { OrganizationForm } from "./organization-form";

export const metadata = { title: "Votre entreprise — Sophie IA" };

export default async function OnboardingPage() {
  const { activeOrganization } = await requireSession();

  // L’onboarding complet (metier, services, horaires, agenda, Sophie, appels)
  // est construit en Phase 1. La Phase 0 s’arrete a la creation du tenant.
  if (activeOrganization) redirect("/app");

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
