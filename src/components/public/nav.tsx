"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export interface LienNav {
  href: string;
  libelle: string;
}

/**
 * Le menu du téléphone.
 *
 * ## Pourquoi un panneau et non un repli
 *
 * Un menu qui pousse le contenu vers le bas fait sauter la page sous le
 * doigt. Un panneau posé par-dessus laisse la page en place.
 *
 * ## Ce que coûte un menu ouvert
 *
 * Il capture la touche Échap, bloque le défilement de la page derrière, et se
 * referme à chaque navigation. Sans le dernier point, on clique sur un lien
 * d'ancre, la page défile derrière le panneau, et on croit que rien ne s'est
 * passé.
 */
export function MenuMobile({ liens }: { liens: LienNav[] }) {
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (!ouvert) return;

    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };

    document.addEventListener("keydown", auClavier);
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", auClavier);
      document.body.style.overflow = precedent;
    };
  }, [ouvert]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-expanded={ouvert}
        aria-label="Ouvrir le menu"
        className="flex size-11 items-center justify-center rounded-control text-ink md:hidden"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M3 6h18M3 12h18M3 18h18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {ouvert ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOuvert(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />

          <nav
            aria-label="Menu principal"
            className="absolute inset-x-0 top-0 rounded-b-sheet bg-surface p-5 shadow-sheet"
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-lg font-semibold">Menu</span>
              <button
                type="button"
                onClick={() => setOuvert(false)}
                aria-label="Fermer le menu"
                className="flex size-11 items-center justify-center rounded-control"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <ul className="mt-3 flex flex-col">
              {liens.map((lien) => (
                <li key={lien.href}>
                  <Link
                    href={lien.href}
                    onClick={() => setOuvert(false)}
                    className="flex min-h-12 items-center border-b border-line text-base"
                  >
                    {lien.libelle}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/signup"
                onClick={() => setOuvert(false)}
                className="pressable flex min-h-12 items-center justify-center rounded-control bg-signal px-4 font-medium text-white"
              >
                Essayer Sophie
              </Link>
              <Link
                href="/login"
                onClick={() => setOuvert(false)}
                className="flex min-h-12 items-center justify-center rounded-control border border-line px-4 font-medium"
              >
                Se connecter
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
