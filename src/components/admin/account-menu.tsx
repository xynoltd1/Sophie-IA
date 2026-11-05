"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "@/app/(auth)/actions";

/**
 * Bloc compte, en bas du panneau.
 *
 * La déconnexion est un vrai formulaire vers une action serveur : elle termine
 * la session Supabase et efface les cookies côté serveur. Un bouton qui se
 * contenterait de vider l'état du navigateur laisserait la session valide —
 * la personne se croirait déconnectée et ne le serait pas, ce qui est pire
 * que pas de bouton du tout sur un poste partagé.
 */
export function AccountMenu({ nom, email }: { nom: string; email: string }) {
  const [ouvert, setOuvert] = useState(false);

  const initiales = nom
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="relative">
      {ouvert ? (
        <div className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-control border border-console-line bg-console-raised">
          <Link
            href="/admin/compte"
            onClick={() => setOuvert(false)}
            className="flex min-h-11 items-center px-3 text-sm text-console-ink-soft hover:bg-console hover:text-console-ink"
          >
            Mon compte
          </Link>
          <Link
            href="/app"
            onClick={() => setOuvert(false)}
            className="flex min-h-11 items-center px-3 text-sm text-console-ink-soft hover:bg-console hover:text-console-ink"
          >
            Retour à l’application
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex min-h-11 w-full items-center px-3 text-left text-sm text-console-ink-soft hover:bg-console hover:text-console-ink"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        className="flex w-full min-h-12 items-center gap-3 rounded-control px-2 text-left hover:bg-console-raised"
      >
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-console-accent text-sm font-semibold text-console"
        >
          {initiales || "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-console-ink">
            {nom}
          </span>
          <span className="block truncate text-xs text-console-ink-soft">
            {email}
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-4 w-4 shrink-0 text-console-ink-soft"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={ouvert ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
        </svg>
      </button>
    </div>
  );
}
