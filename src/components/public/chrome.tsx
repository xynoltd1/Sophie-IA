import Link from "next/link";
import { MesureVisite } from "@/components/analytics/mesure-visite";

/**
 * L'habillage du site public : en-tête, pied de page, mesure de visite.
 *
 * ## Pourquoi un composant et non une mise en page de groupe de routes
 *
 * C'était `src/app/(public)/layout.tsx`. Next.js n'émet pas le manifeste des
 * composants clients pour une page d'accueil placée dans un groupe de routes :
 * la compilation passe en local, et le déploiement échoue sur
 * `page_client-reference-manifest.js introuvable`. Le symptôme n'apparaît donc
 * qu'au dernier moment, là où il coûte le plus cher.
 *
 * La page d'accueil est revenue à `src/app/page.tsx`, et l'habillage est
 * devenu ce composant. Une page publique de plus l'enveloppe de la même façon.
 */
export function HabillagePublic({ children }: { children: React.ReactNode }) {
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
