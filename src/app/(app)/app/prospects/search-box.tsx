"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Recherche globale (section 33).
 *
 * La recherche passe par la barre d'adresse plutôt que par un état local :
 * l'artisan peut ainsi revenir en arrière, garder un résultat en favori, ou
 * recharger sans perdre sa recherche.
 */
export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [terme, setTerme] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  function chercher(valeur: string) {
    setTerme(valeur);
    startTransition(() => {
      const suivant = new URLSearchParams(params.toString());
      if (valeur.trim()) suivant.set("q", valeur.trim());
      else suivant.delete("q");
      router.replace(`/app/prospects?${suivant.toString()}`);
    });
  }

  return (
    <div className="relative">
      <input
        type="search"
        value={terme}
        onChange={(event) => chercher(event.target.value)}
        placeholder="Nom, téléphone, ville…"
        aria-label="Rechercher un client ou une demande"
        className="min-h-12 w-full rounded-control border border-line bg-surface px-3.5 text-base text-ink placeholder:text-ink-faint"
      />
      {pending ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
          …
        </span>
      ) : null}
    </div>
  );
}
