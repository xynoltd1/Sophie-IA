import { requireOrganization } from "@/lib/auth/session";
import { AppHeader } from "@/components/nav/app-header";
import { BottomNav } from "@/components/nav/bottom-nav";
import { alertesNonLues, etatLigneSophie } from "@/lib/crm/queries";

/**
 * Rendu dynamique obligatoire : cette page dépend de la session de
 * l'utilisateur. Sans cette directive, Next tente de la prérendre au moment du
 * build, où aucune session ni aucune variable d'environnement n'existe.
 */
export const dynamic = "force-dynamic";

// Espace prive : jamais indexe, quoi que dise robots.txt. Ce fichier-la est
// une demande polie ; cet en-tete est une consigne que Google applique meme
// s'il arrive sur la page par un lien.
export const metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeOrganization } = await requireOrganization();

  // Cette valeur etait ecrite en dur a false depuis la Phase 0. L en-tete
  // annoncait donc « Sophie en pause » meme quand elle venait de repondre a un
  // appel. Un voyant qui ne regarde rien est pire que pas de voyant.
  const ligne = await etatLigneSophie(activeOrganization.organization_id);
  const sophieActive = ligne.repond;
  const alertes = await alertesNonLues(activeOrganization.organization_id);

  return (
    <div className="min-h-dvh">
      <AppHeader
        organizationName={activeOrganization.name}
        sophieActive={sophieActive}
        alertes={alertes}
      />
      <main className="mx-auto max-w-2xl px-4 pb-navbar pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
