import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Liste groupée.
 *
 * Six cartes d'alerte empilées, toutes de la même couleur ambre, ne font pas
 * six priorités : elles font un mur. Quand tout crie, rien ne s'entend.
 *
 * Ce groupe tient les signaux secondaires dans **une** surface, avec un filet
 * entre les lignes et le nombre en tête de ligne. L'urgence réelle garde sa
 * carte à elle, détachée au-dessus : c'est elle qui doit être la seule chose
 * colorée de l'écran.
 */
export function RowGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-sheet border border-line bg-surface shadow-sheet">
      {children}
    </div>
  );
}

export function Row({
  href,
  compte,
  titre,
  detail,
  ton = "neutre",
}: {
  href: string;
  /** Le nombre en tête de ligne. Absent quand la ligne n'en a pas. */
  compte?: number;
  titre: string;
  detail?: string;
  ton?: "neutre" | "attention";
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 px-4 py-3.5 transition-colors active:bg-paper md:hover:bg-paper"
    >
      {compte !== undefined ? (
        <span
          aria-hidden
          className={cn(
            "tabular min-w-9 text-center text-xl font-semibold leading-none",
            ton === "attention" ? "text-attention" : "text-ink",
          )}
        >
          {compte}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{titre}</span>
        {detail ? (
          <span className="mt-0.5 block text-sm leading-snug text-ink-soft">{detail}</span>
        ) : null}
      </span>
      <span aria-hidden className="shrink-0 text-ink-faint">
        →
      </span>
    </Link>
  );
}
