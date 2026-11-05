import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Qui a le droit de déclencher un travail planifié.
 *
 * Sans ce contrôle, n'importe qui pourrait appeler ces adresses en boucle et
 * épuiser un quota externe — Google, le fournisseur d'IA — ou faire tourner
 * des traitements payants.
 *
 * Deux secrets acceptés : celui que l'hébergeur ajoute à ses déclenchements
 * planifiés, et un second pour un déclenchement manuel ou depuis un autre
 * ordonnanceur. Comparaison à temps constant : une comparaison naïve laisse
 * deviner le secret caractère par caractère.
 */
export function jobAutorise(headers: Headers): boolean {
  const acceptes = [
    process.env.CRON_SECRET?.trim(),
    process.env.JOB_RUNNER_SECRET?.trim(),
  ].filter((valeur): valeur is string => Boolean(valeur));

  if (acceptes.length === 0) return false;

  const fourni =
    headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    headers.get("x-job-secret") ??
    "";

  if (!fourni) return false;

  const a = Buffer.from(fourni);
  return acceptes.some((attendu) => {
    const b = Buffer.from(attendu);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
