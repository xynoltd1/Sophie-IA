import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sidebar } from "@/components/admin/sidebar";
import { AccountMenu } from "@/components/admin/account-menu";

export const dynamic = "force-dynamic";

// Espace privé : jamais indexé, quoi que dise robots.txt. Ce fichier-là est
// une demande polie ; cet en-tête est une consigne que Google applique même
// s'il arrive sur la page par un lien.
export const metadata = { robots: { index: false, follow: false } };

/**
 * Console d'administration de la plateforme (section 37).
 *
 * Séparée de l'application cliente de bout en bout : autre mise en page, autre
 * chemin, autre contrôle d'accès, autre couleur. La couleur n'est pas un
 * détail : quelqu'un qui a sous les yeux les données de toutes les entreprises
 * doit savoir en un coup d'œil qu'il n'est plus chez lui.
 *
 * La garde est appelée ici **et** dans chaque page. Une mise en page protégée
 * ne protège pas les pages qu'elle contient si l'une d'elles est atteinte
 * autrement — et une vérification en trop ne coûte qu'une requête.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, email } = await requirePlatformAdmin();

  const supabase = await createServerSupabase();
  const { data: profil } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  return (
    <div className="min-h-dvh bg-paper">
      <Sidebar
        compte={
          <AccountMenu
            nom={(profil?.full_name as string | undefined) ?? "Administrateur"}
            email={email ?? ""}
          />
        }
      />

      <div className="lg:pl-64">
        <div className="mx-auto max-w-5xl px-5 py-6 lg:py-8">{children}</div>
      </div>
    </div>
  );
}
