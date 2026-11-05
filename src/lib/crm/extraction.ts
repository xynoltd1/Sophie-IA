/**
 * Affichage des champs extraits d'un appel (section 15).
 *
 * Seuls les champs réellement présents sont montrés. Une liste de dix lignes
 * dont huit disent « inconnu » n'informe pas : elle oblige à chercher les deux
 * qui comptent.
 */

export const LIBELLES_EXTRACTION: Record<string, string> = {
  intent: "Demande",
  service: "Service",
  urgency: "Urgence",
  customer_name: "Nom donné",
  address: "Adresse",
  requested_date: "Date souhaitée",
  requested_time: "Heure souhaitée",
  problem_description: "Problème décrit",
  appointment_requested: "Rendez-vous demandé",
  callback_requested: "Rappel demandé",
};

/** Ordre d'affichage : ce qui déclenche une action d'abord. */
const ORDRE = [
  "urgency",
  "intent",
  "service",
  "problem_description",
  "customer_name",
  "address",
  "requested_date",
  "requested_time",
  "appointment_requested",
  "callback_requested",
];

export interface ChampExtrait {
  cle: string;
  libelle: string;
  valeur: string;
}

export function champsExtraits(
  donnees: Record<string, unknown> | null,
): ChampExtrait[] {
  if (!donnees) return [];

  const presentes = Object.keys(donnees);
  const cles = [
    ...ORDRE.filter((c) => presentes.includes(c)),
    ...presentes.filter((c) => !ORDRE.includes(c)),
  ];

  const champs: ChampExtrait[] = [];

  for (const cle of cles) {
    const brut = donnees[cle];
    if (brut === null || brut === undefined || brut === "") continue;

    const valeur =
      typeof brut === "boolean"
        ? brut
          ? "oui"
          : "non"
        : typeof brut === "object"
          ? JSON.stringify(brut)
          : String(brut);

    champs.push({ cle, libelle: LIBELLES_EXTRACTION[cle] ?? cle, valeur });
  }

  return champs;
}
