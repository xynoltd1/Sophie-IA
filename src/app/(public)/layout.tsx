import Link from "next/link";
import { MesureVisite } from "@/components/analytics/mesure-visite";

/**
 * Le site public.
 *
 * Séparé de l'application par un groupe de routes : une autre mise en page,
 * une autre densité, un autre métier. L'application sert quelqu'un qui est
 * déjà client et pressé ; cette page sert quelqu'un qui ne sait pas encore ce
 * que fait le produit.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-paper">
      <MesureVisite />

      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5">
          <Link
            href="/"
            className="font-display text-lg font-semibold tracking-tight"
          >
            Sophie IA
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-ink-soft hover:text-ink"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="pressable flex min-h-11 items-center rounded-control bg-signal px-4 text-sm font-medium text-white"
            >
              Essayer Sophie
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>
            Sophie IA — secrétaire téléphonique pour les métiers de terrain.
          </p>
          <p className="text-ink-faint">
            France et Belgique · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
