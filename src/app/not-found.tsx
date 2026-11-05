import Link from "next/link";

export const metadata = {
  title: "Page introuvable — Sophie IA",
  robots: { index: false, follow: true },
};

/**
 * 404.
 *
 * Next renvoie bien le code 404 avec cette page : c'est ce qui compte pour un
 * moteur. Une page d'erreur qui répondrait 200 ferait indexer l'erreur
 * elle-même, et Google la compterait comme du contenu de faible qualité.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-5">
      <div className="max-w-md text-center">
        <p className="font-display text-5xl font-semibold text-signal">404</p>
        <h1 className="mt-4 font-display text-2xl font-semibold">
          Cette page n’existe pas
        </h1>
        <p className="mt-2 text-ink-soft">
          Le lien est peut-être ancien, ou la page a changé d’adresse.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="pressable flex min-h-12 items-center rounded-control bg-signal px-5 font-medium text-white"
          >
            Retour à l’accueil
          </Link>
          <Link
            href="/app"
            className="flex min-h-12 items-center rounded-control border border-line bg-surface px-5 font-medium"
          >
            Mon espace
          </Link>
        </div>
      </div>
    </div>
  );
}
