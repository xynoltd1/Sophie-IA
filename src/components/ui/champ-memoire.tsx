"use client";

import { useState } from "react";
import { Input } from "./field";

/**
 * Un champ qui garde ce qu'on a tapé, même quand l'enregistrement échoue.
 *
 * ## Le défaut qu'il règle
 *
 * React remet un formulaire à zéro après une action serveur. Un champ rempli
 * par `defaultValue` est donc vidé à chaque échec : la personne retape son
 * texte pour se heurter à la même erreur, puisque la cause, elle, n'a pas
 * bougé.
 *
 * ## Pourquoi un composant plutôt qu'un état dans chaque formulaire
 *
 * Le composant possède son propre état. Il survit aux rendus du parent sans
 * que le parent ait à déclarer quoi que ce soit — un `useState` par champ,
 * répété dans huit formulaires, finit par être oublié quelque part.
 *
 * ## Quand ne pas l'utiliser
 *
 * Quand le parent a besoin de lire la valeur pendant la saisie : un aperçu en
 * direct, un total qui se met à jour, une validation au caractère près. Là,
 * l'état appartient au parent.
 */
export function InputMemoire({
  valeurInitiale,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "defaultValue"> & {
  valeurInitiale: string;
}) {
  const [valeur, setValeur] = useState(valeurInitiale);

  return (
    <Input
      {...props}
      value={valeur}
      onChange={(e) => {
        setValeur(e.target.value);
        props.onChange?.(e);
      }}
    />
  );
}

/** Même principe, pour une zone de texte. */
export function TextareaMemoire({
  valeurInitiale,
  ...props
}: Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "defaultValue"
> & {
  valeurInitiale: string;
}) {
  const [valeur, setValeur] = useState(valeurInitiale);

  return (
    <textarea
      {...props}
      value={valeur}
      onChange={(e) => {
        setValeur(e.target.value);
        props.onChange?.(e);
      }}
    />
  );
}
