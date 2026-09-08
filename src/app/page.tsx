import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";

/**
 * Rendu dynamique obligatoire : cette page dépend de la session de
 * l'utilisateur. Sans cette directive, Next tente de la prérendre au moment du
 * build, où aucune session ni aucune variable d'environnement n'existe.
 */
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const context = await getSessionContext();

  if (!context) redirect("/login");
  if (!context.activeOrganization) redirect("/onboarding");
  redirect("/app");
}
