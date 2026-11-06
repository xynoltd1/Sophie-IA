import Link from "next/link";
import { MesureVisite } from "@/components/analytics/mesure-visite";
import { MenuMobile, type LienNav } from "./nav";
import { SITE_NAME } from "@/lib/seo/site";

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

const LIENS: LienNav[] = [
  { href: "/#fonctionnement", libelle: "Comment ça marche" },
  { href: "/#demonstration", libelle: "Démonstration" },
  { href: "/#metiers", libelle: "Métiers" },
  { href: "/#acces", libelle: "Accès" },
  { href: "/#questions", libelle: "Questions" },
];

/** Les pages légales. Marquées comme brouillons tant qu'un juriste ne les a pas lues. */
export const LIENS_LEGAUX: LienNav[] = [
  { href: "/mentions-legales", libelle: "Mentions légales" },
  { href: "/confidentialite", libelle: "Politique de confidentialité" },
  { href: "/cgu", libelle: "Conditions d’utilisation" },
  { href: "/cgv", libelle: "Conditions de vente" },
  { href: "/cookies", libelle: "Cookies et mesure d’audience" },
];

function Marque({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 32 32"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="9" fill="#0a6b4f" />
        {/* Trois barres de voix : la marque dit ce que fait le produit. */}
        <rect x="9" y="13" width="3" height="6" rx="1.5" fill="#8ddcbb" />
        <rect x="14.5" y="9" width="3" height="14" rx="1.5" fill="#ffffff" />
        <rect x="20" y="12" width="3" height="8" rx="1.5" fill="#8ddcbb" />
      </svg>
      <span className="font-display text-lg font-semibold tracking-tight">
        {SITE_NAME}
      </span>
    </span>
  );
}

export function HabillagePublic({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <MesureVisite />

      <a
        href="#contenu"
        className="lecteur-seul focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2"
      >
        Aller au contenu
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" aria-label={`${SITE_NAME}, accueil`}>
            <Marque />
          </Link>

          <nav
            aria-label="Navigation principale"
            className="hidden items-center gap-1 md:flex"
          >
            {LIENS.map((lien) => (
              <Link
                key={lien.href}
                href={lien.href}
                className="flex min-h-11 items-center rounded-control px-3 text-sm text-ink-soft transition-colors hover:bg-ink-tint hover:text-ink"
              >
                {lien.libelle}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden min-h-11 items-center rounded-control px-3 text-sm font-medium text-ink-soft hover:text-ink sm:flex"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="pressable hidden min-h-11 items-center rounded-control bg-signal px-4 text-sm font-medium text-white transition-colors hover:bg-signal-deep md:flex"
            >
              Essayer Sophie
            </Link>
            <MenuMobile liens={LIENS} />
          </div>
        </div>
      </header>

      <main id="contenu">{children}</main>

      <PiedDePage />
    </div>
  );
}

function ColonneLiens({ titre, liens }: { titre: string; liens: LienNav[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink">{titre}</p>
      <ul className="mt-3 flex flex-col gap-0.5">
        {liens.map((lien) => (
          <li key={lien.href + lien.libelle}>
            <Link
              href={lien.href}
              className="flex min-h-11 items-center text-sm text-ink-soft hover:text-ink hover:underline"
            >
              {lien.libelle}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PiedDePage() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Marque />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
              La secrétaire téléphonique des métiers de terrain. Elle répond
              pendant que vous travaillez ; vous gardez la décision.
            </p>
          </div>

          <ColonneLiens
            titre="Produit"
            liens={[
              { href: "/#fonctionnement", libelle: "Comment ça marche" },
              { href: "/#demonstration", libelle: "Démonstration" },
              { href: "/#garanties", libelle: "Ce qu’elle ne fait jamais" },
              { href: "/#integrations", libelle: "Intégrations" },
              { href: "/#metiers", libelle: "Métiers" },
              { href: "/#acces", libelle: "Accès et offres" },
              { href: "/#questions", libelle: "Questions fréquentes" },
            ]}
          />

          <ColonneLiens
            titre="Entreprise"
            liens={[
              { href: "/#acces", libelle: "Demander un accès" },
              { href: "/signup", libelle: "Créer un compte" },
              { href: "/login", libelle: "Se connecter" },
            ]}
          />

          <div>
            <ColonneLiens titre="Informations légales" liens={LIENS_LEGAUX} />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-faint">
              Ces documents sont des brouillons. Ils n’ont pas été relus par un
              juriste et ne sont pas opposables.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            {SITE_NAME} — France et Belgique · {new Date().getFullYear()}
          </p>
          <p>
            Mesure d’audience sans cookie ni traceur.{" "}
            <Link href="/cookies" className="underline hover:text-ink-soft">
              En savoir plus
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
