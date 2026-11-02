import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/platform";

export const dynamic = "force-dynamic";

const ONGLETS = [
  { href: "/admin", libelle: "Vue d’ensemble" },
  { href: "/admin/organisations", libelle: "Entreprises" },
  { href: "/admin/metiers", libelle: "Métiers" },
  { href: "/admin/plans", libelle: "Offres" },
  { href: "/admin/sante", libelle: "Santé" },
];

/**
 * Espace d'administration de la plateforme (section 37).
 *
 * Séparé de l'application cliente : une autre mise en page, un autre chemin,
 * un autre contrôle d'accès. Rien n'y est partagé avec l'espace des
 * entreprises, pour qu'aucune erreur de l'un ne devienne une faille de l'autre.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-ink text-surface">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-lg font-semibold">Sophie — plateforme</p>
            <Link href="/app" className="text-sm underline underline-offset-4">
              Retour à l’application
            </Link>
          </div>
          <nav className="flex gap-3 overflow-x-auto">
            {ONGLETS.map((onglet) => (
              <Link
                key={onglet.href}
                href={onglet.href}
                className="shrink-0 text-sm text-surface/80 underline-offset-4 hover:underline"
              >
                {onglet.libelle}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
