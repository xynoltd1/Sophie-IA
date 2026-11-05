import "server-only";

import { createHash } from "node:crypto";

/**
 * Identifiant de session, sans cookie et sans suivi d'un jour à l'autre.
 *
 * ## Comment
 *
 * Une empreinte de quelques éléments volatils — adresse IP, agent utilisateur,
 * langue — mélangés à une graine secrète **et à la date du jour**. Le résultat
 * regroupe les pages vues d'une même visite, et rien de plus : demain, le même
 * navigateur produit une empreinte totalement différente.
 *
 * ## Pourquoi pas de cookie
 *
 * Un cookie de mesure déclenche l'obligation de consentement dans l'Union
 * européenne. Une bannière sur un site qui n'a pas encore de client coûte plus
 * qu'elle ne rapporte, et elle fausse la mesure qu'elle est censée permettre.
 *
 * ## Ce qu'on perd
 *
 * Le visiteur unique sur plusieurs jours. Quelqu'un qui revient trois jours de
 * suite compte comme trois sessions. C'est une sous-estimation de la fidélité
 * et une surestimation de l'audience nouvelle — il faut le savoir en lisant
 * les chiffres, et c'est écrit sur l'écran.
 *
 * ## Ce que la base ne voit jamais
 *
 * Ni l'adresse IP ni l'agent utilisateur : ils entrent dans le hachage et
 * n'en ressortent pas. Le hachage n'est pas réversible, et la graine du jour
 * est perdue le lendemain.
 */
export function empreinteSession(params: {
  ip: string | null;
  userAgent: string | null;
  langue: string | null;
}): string {
  const graine = process.env.SECRETS_ENCRYPTION_KEY ?? "sophie-ia-sans-graine";
  const jour = new Date().toISOString().slice(0, 10);

  return createHash("sha256")
    .update(
      [
        jour,
        graine,
        params.ip ?? "",
        params.userAgent ?? "",
        params.langue ?? "",
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 32);
}

/**
 * Le domaine d'où vient la visite, jamais l'adresse complète.
 *
 * Une adresse de provenance peut contenir une requête de recherche, un
 * identifiant de campagne personnel, parfois un jeton. Le domaine suffit à
 * savoir d'où viennent les gens.
 */
export function domaineProvenance(referent: string | null): string | null {
  if (!referent) return null;
  try {
    const hote = new URL(referent).hostname.replace(/^www\./, "");
    return hote.length > 0 && hote.length <= 120 ? hote : null;
  } catch {
    return null;
  }
}

/** Clé de déduplication : une même action, dans la même minute, compte une fois. */
export function cleDeduplication(params: {
  session: string;
  evenement: string;
  chemin: string;
}): string {
  const minute = new Date().toISOString().slice(0, 16);
  return `${params.session}:${params.evenement}:${params.chemin}:${minute}`;
}
