"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { creerDevis, type DevisState } from "./actions";

/**
 * Le bouton « Nouveau devis », et son message d'erreur.
 *
 * Il est à part de la page parce qu'une action qui peut échouer doit pouvoir
 * le dire à l'endroit où on a cliqué. Avant, l'échec remontait en exception et
 * Next affichait sa page « Application error » avec un numéro : l'artisan
 * voyait un écran blanc sans savoir quoi faire.
 */
export function BoutonNouveauDevis() {
  const [state, action, pending] = useActionState<DevisState, FormData>(
    creerDevis,
    {},
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={action}>
        <input type="hidden" name="title" value="Nouveau devis" />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Création…" : "Nouveau devis"}
        </Button>
      </form>

      {state.error ? (
        <p
          role="alert"
          className="max-w-md rounded-control bg-urgent-soft px-3 py-2.5 text-sm leading-relaxed"
        >
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
