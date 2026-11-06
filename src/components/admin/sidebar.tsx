"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Navigation verticale de la console.
 *
 * ## Pourquoi verticale, et pourquoi elle remplace l'ancienne barre
 *
 * L'ancienne navigation était horizontale : cinq onglets côte à côte. Au
 * sixième, il aurait fallu faire défiler, et au neuvième la barre serait
 * devenue illisible. Une console de pilotage grandit par rubriques ; une
 * colonne grandit vers le bas, ce qu'un écran accepte, pendant qu'une rangée
 * grandit vers la droite, ce qu'il refuse.
 *
 * ## Sur téléphone
 *
 * Le panneau est caché et s'ouvre par un bouton. Il se ferme dès qu'on choisit
 * une rubrique : sur un petit écran, un menu qui reste ouvert cache la page
 * qu'on vient de demander.
 */
export interface Rubrique {
  href: string;
  libelle: string;
  /** Tracé SVG 24×24, dessiné au trait pour rester lisible en petit. */
  icone: string;
  /** Regroupement visuel. Les rubriques d'un même groupe se suivent. */
  groupe: "pilotage" | "clients" | "exploitation";
}

export const RUBRIQUES: readonly Rubrique[] = [
  {
    href: "/admin",
    libelle: "Vue d’ensemble",
    groupe: "pilotage",
    icone: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5",
  },
  {
    href: "/admin/statistiques",
    libelle: "Statistiques",
    groupe: "pilotage",
    icone: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  },
  {
    href: "/admin/seo",
    libelle: "SEO et acquisition",
    groupe: "pilotage",
    icone: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
  },
  {
    href: "/admin/organisations",
    libelle: "Entreprises",
    groupe: "clients",
    icone: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 11h.01M15 11h.01",
  },
  {
    href: "/admin/utilisateurs",
    libelle: "Utilisateurs",
    groupe: "clients",
    icone:
      "M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1.5a4 4 0 0 0-3-3.87",
  },
  {
    href: "/admin/metiers",
    libelle: "Métiers",
    groupe: "clients",
    icone:
      "M3 8h18v12H3zM8 8V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V8M3 13h18",
  },
  {
    href: "/admin/plans",
    libelle: "Offres et abonnements",
    groupe: "clients",
    icone: "M3 6.5h18v11H3zM3 10h18M7 14h4",
  },
  {
    href: "/admin/consommation",
    libelle: "Appels et consommation",
    groupe: "exploitation",
    icone:
      "M20 16.5v2.5a1.5 1.5 0 0 1-1.7 1.5A18 18 0 0 1 3.5 5.7 1.5 1.5 0 0 1 5 4h2.5a1.5 1.5 0 0 1 1.5 1.3c.1.9.3 1.7.6 2.5a1.5 1.5 0 0 1-.4 1.6L8.2 10.4a14 14 0 0 0 5.4 5.4l1-1a1.5 1.5 0 0 1 1.6-.3c.8.3 1.6.5 2.5.6a1.5 1.5 0 0 1 1.3 1.4Z",
  },
  {
    href: "/admin/integrations",
    libelle: "Intégrations",
    groupe: "exploitation",
    icone: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  },
  {
    href: "/admin/sante",
    libelle: "Santé du système",
    groupe: "exploitation",
    icone: "M3 12h4l2.5-6 4 13L16 12h5",
  },
  {
    href: "/admin/parametres",
    libelle: "Paramètres",
    groupe: "exploitation",
    icone: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 14H3a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4.3 7.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.3 1.2Z",
  },
  {
    href: "/admin/compte",
    libelle: "Mon compte",
    groupe: "exploitation",
    icone:
      "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  },
] as const;

const TITRES_GROUPES: Record<Rubrique["groupe"], string> = {
  pilotage: "Pilotage",
  clients: "Clients",
  exploitation: "Exploitation",
};

function estActive(chemin: string, href: string): boolean {
  if (href === "/admin") return chemin === "/admin";
  return chemin === href || chemin.startsWith(`${href}/`);
}

export function Sidebar({ compte }: { compte: React.ReactNode }) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);

  const groupes: Rubrique["groupe"][] = ["pilotage", "clients", "exploitation"];

  const contenu = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <p className="font-display text-lg font-semibold text-console-ink">
          Zeli
          <span className="ml-1.5 font-normal text-console-ink-soft">
            plateforme
          </span>
        </p>
      </div>

      <nav aria-label="Rubriques" className="flex-1 overflow-y-auto px-3 pb-4">
        {groupes.map((groupe) => (
          <div key={groupe} className="mb-5">
            <p className="px-2 pb-1.5 text-xs font-medium uppercase tracking-wide text-console-ink-soft">
              {TITRES_GROUPES[groupe]}
            </p>
            <ul className="flex flex-col gap-0.5">
              {RUBRIQUES.filter((r) => r.groupe === groupe).map((rubrique) => {
                const active = estActive(chemin, rubrique.href);
                return (
                  <li key={rubrique.href}>
                    <Link
                      href={rubrique.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOuvert(false)}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-control px-2.5 text-sm transition-colors",
                        active
                          ? "bg-console-raised font-medium text-console-accent"
                          : "text-console-ink-soft hover:bg-console-raised hover:text-console-ink",
                      )}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden
                        className="h-5 w-5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.7}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={rubrique.icone} />
                      </svg>
                      <span className="truncate">{rubrique.libelle}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-console-line p-3">{compte}</div>
    </div>
  );

  return (
    <>
      {/* Téléphone : un bouton, et le panneau par-dessus. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-console-line bg-console px-4 py-2.5 lg:hidden">
        <button
          type="button"
          onClick={() => setOuvert((v) => !v)}
          aria-expanded={ouvert}
          aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
          className="flex h-11 w-11 items-center justify-center rounded-control text-console-ink"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
          >
            {ouvert ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
        <p className="font-display font-semibold text-console-ink">
          Zeli — plateforme
        </p>
      </div>

      {ouvert ? (
        <div className="fixed inset-0 top-[60px] z-20 bg-console lg:hidden">
          {contenu}
        </div>
      ) : null}

      {/* Ordinateur : colonne fixe. */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-console-line bg-console lg:block">
        {contenu}
      </aside>
    </>
  );
}
