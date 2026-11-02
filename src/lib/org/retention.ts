/**
 * Durées de conservation des données d'appel.
 *
 * Quatre durées, et une seule était réglable jusqu'ici. L'audio avait sa
 * politique (ADR-013, 30 jours au maximum) ; la transcription, le résumé et les
 * messages restaient indéfiniment. Garder indéfiniment n'est pas une décision
 * neutre : c'est une décision par défaut, prise par omission, et c'est celle
 * qu'un contrôle reproche.
 *
 * ## Pourquoi des bornes, et celles-là
 *
 * Le plancher de 30 jours protège le professionnel : en dessous, il perdrait
 * l'historique d'un chantier avant la fin du chantier. Le plafond de 5 ans
 * correspond à la durée de prescription commerciale usuelle en France et en
 * Belgique — au-delà, conserver un échange téléphonique devient difficile à
 * justifier.
 *
 * Ces deux bornes sont aussi écrites en base (migration 0030). Ce module est un
 * confort d'interface, pas la garantie.
 *
 * ## Ce que ce module ne décide pas
 *
 * Il ne dit pas quelle durée est *légalement* correcte pour un métier ou un
 * pays donné. Cette question reste ouverte et documentée dans
 * `docs/LEGAL_COMPLIANCE.md` (point L5). L'interface doit le dire au
 * professionnel plutôt que de lui laisser croire que le réglage par défaut a
 * été validé par quelqu'un.
 */

export const MIN_RETENTION_DAYS = 30;
export const MAX_RETENTION_DAYS = 1825;
export const DEFAUT_RETENTION_DAYS = 365;

export type RetentionField =
  | "transcript_retention_days"
  | "summary_retention_days"
  | "message_retention_days";

export interface RetentionSettings {
  transcript_retention_days: number;
  summary_retention_days: number;
  message_retention_days: number;
}

export interface RetentionDescription {
  champ: RetentionField;
  titre: string;
  detail: string;
}

/** L'ordre d'affichage suit l'ordre de la purge : du plus lourd au plus léger. */
export const RETENTION_FIELDS: readonly RetentionDescription[] = [
  {
    champ: "transcript_retention_days",
    titre: "Transcriptions",
    detail:
      "Le texte de ce qui a été dit pendant l'appel. Supprimé passé ce délai ; " +
      "le résumé, lui, reste tant que sa propre durée n'est pas écoulée.",
  },
  {
    champ: "summary_retention_days",
    titre: "Résumés et données extraites",
    detail:
      "Le résumé de Sophie et les informations qu'elle a relevées (nom, adresse, " +
      "problème). La fiche d'appel reste, avec sa date et sa durée.",
  },
  {
    champ: "message_retention_days",
    titre: "Messages et SMS",
    detail:
      "Les SMS envoyés et les messages reçus. Les rendez-vous et les contacts " +
      "ne sont pas concernés.",
  },
];

export function clampRetention(days: number): number {
  if (!Number.isFinite(days)) return DEFAUT_RETENTION_DAYS;
  return Math.min(
    Math.max(Math.round(days), MIN_RETENTION_DAYS),
    MAX_RETENTION_DAYS,
  );
}

/**
 * La durée en mots, parce que « 1825 jours » ne veut rien dire pour personne.
 *
 * On arrondit volontairement : le but est de donner un ordre de grandeur
 * vérifiable d'un coup d'œil, pas une conversion exacte.
 */
export function dureeLisible(days: number): string {
  if (days >= 365 && days % 365 === 0) {
    const annees = days / 365;
    return annees === 1 ? "un an" : `${annees} ans`;
  }
  if (days >= 60 && days % 30 === 0) return `${days / 30} mois`;
  if (days === 30) return "un mois";
  return `${days} jours`;
}
