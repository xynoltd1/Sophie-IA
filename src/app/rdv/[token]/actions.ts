"use server";

import { createServerSupabase } from "@/lib/supabase/server";

export type ReponseClient =
  | "ACCEPTE"
  | "REFUSE"
  | "EXPIRE"
  | "DEJA_TRAITE"
  | "CRENEAU_PRIS"
  | "INTROUVABLE";

/**
 * Réponse du client, sans compte et sans session.
 *
 * Toute la décision est prise en base par `respond_to_proposal` : c'est elle
 * qui vérifie le jeton, l'expiration, l'état, et surtout qui se heurte à la
 * contrainte d'exclusion si le créneau a été pris entre-temps. Faire ces
 * vérifications ici laisserait une fenêtre entre le contrôle et l'écriture.
 */
export async function repondreProposition(
  token: string,
  accepte: boolean,
): Promise<{ resultat: ReponseClient }> {
  if (!token || token.length < 16) return { resultat: "INTROUVABLE" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("respond_to_proposal", {
    jeton: token,
    accepte,
  });

  if (error) return { resultat: "INTROUVABLE" };

  const ligne = (Array.isArray(data) ? data[0] : data) as
    { resultat?: string } | undefined;
  return { resultat: (ligne?.resultat as ReponseClient) ?? "INTROUVABLE" };
}
