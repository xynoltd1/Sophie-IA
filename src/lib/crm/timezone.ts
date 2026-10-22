/**
 * Conversion d'une heure locale en instant précis.
 *
 * Le piège, et il a coûté un rendez-vous décalé de deux heures : en JavaScript,
 * `new Date("2026-10-23T08:00:00")` sans suffixe est interprété dans le fuseau
 * de la MACHINE. Sur Vercel, cette machine est en temps universel. Un client
 * qui dit « huit heures » à Tongeren se retrouvait donc avec un rendez-vous à
 * dix heures — et rien ne signalait l'erreur, puisque les deux valeurs sont des
 * heures parfaitement valides.
 *
 * Le fuseau de l'organisation est la seule référence correcte : c'est celui
 * dans lequel l'artisan et son client parlent.
 */

/**
 * Transforme une date et une heure dites à voix haute en instant universel.
 *
 * @param dateISO  jour au format AAAA-MM-JJ
 * @param heure    heure murale au format HH:MM, telle que prononcée
 * @param timezone fuseau de l'organisation, par exemple Europe/Brussels
 */
export function instantDepuisHeureLocale(
  dateISO: string,
  heure: string,
  timezone: string,
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;
  if (!/^\d{2}:\d{2}$/.test(heure)) return null;

  // Première estimation : on suppose que l'heure murale est universelle, puis
  // on mesure l'écart réel et on corrige.
  const estimation = new Date(`${dateISO}T${heure}:00Z`);
  if (Number.isNaN(estimation.getTime())) return null;

  const corrige = new Date(estimation.getTime() - decalage(estimation, timezone));

  // Deuxième passe : aux changements d'heure, l'écart du premier calcul peut
  // être celui de l'autre côté de la bascule. On recalcule une fois avec
  // l'instant corrigé, ce qui suffit pour les fuseaux à décalage horaire
  // classique.
  const affine = new Date(estimation.getTime() - decalage(corrige, timezone));

  return Number.isNaN(affine.getTime()) ? null : affine;
}

/** Écart, en millisecondes, entre un instant et son heure murale dans un fuseau. */
function decalage(instant: Date, timezone: string): number {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parties: Record<string, string> = {};
  for (const partie of format.formatToParts(instant)) {
    if (partie.type !== "literal") parties[partie.type] = partie.value;
  }

  // `hour` peut valoir « 24 » à minuit selon les environnements.
  const heure = parties.hour === "24" ? "00" : parties.hour;

  const mural = Date.UTC(
    Number(parties.year),
    Number(parties.month) - 1,
    Number(parties.day),
    Number(heure),
    Number(parties.minute),
    Number(parties.second),
  );

  return mural - instant.getTime();
}
