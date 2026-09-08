import type { OrganizationRow } from "@/types/database";

/**
 * Politique d'enregistrement des appels.
 *
 * Decision produit (ADR-013) : l'audio original est conserve 30 jours au
 * maximum, puis supprime automatiquement. La transcription et le resume ne sont
 * pas concernes par cette purge.
 *
 * Le plafond est aussi une contrainte en base : ce module est un confort
 * d'interface, pas la garantie.
 */
export const MAX_AUDIO_RETENTION_DAYS = 30;

export type RecordingPolicy = Pick<
  OrganizationRow,
  | "recording_enabled"
  | "audio_retention_days"
  | "recording_notice_required"
  | "recording_notice_text"
  | "recording_policy_accepted_at"
  | "is_test_organization"
>;

/** L'enregistrement ne peut etre active qu'apres acceptation de la charte. */
export function canEnableRecording(policy: RecordingPolicy): boolean {
  return policy.recording_policy_accepted_at !== null;
}

export function isRecordingActive(policy: RecordingPolicy): boolean {
  return policy.recording_enabled && canEnableRecording(policy);
}

/** Borne la valeur saisie par l'utilisateur au plafond autorise. */
export function clampRetentionDays(days: number): number {
  if (!Number.isFinite(days)) return MAX_AUDIO_RETENTION_DAYS;
  return Math.min(Math.max(Math.round(days), 1), MAX_AUDIO_RETENTION_DAYS);
}

/** Date de purge prevue d'un enregistrement realise a `recordedAt`. */
export function purgeDate(recordedAt: Date, retentionDays: number): Date {
  const date = new Date(recordedAt);
  date.setUTCDate(date.getUTCDate() + clampRetentionDays(retentionDays));
  return date;
}

/**
 * Marqueur affiché partout où un texte d'annonce non validé est visible.
 * Voir docs/LEGAL_COMPLIANCE.md, point L9.
 */
export const UNVALIDATED_NOTICE_WARNING = "NON VALIDÉ JURIDIQUEMENT";

export interface ResolvedNotice {
  body: string;
  isLegallyValidated: boolean;
  source: string;
}

/**
 * Texte d'annonce de secours.
 *
 * PLACEHOLDER — NON VALIDÉ JURIDIQUEMENT.
 *
 * Le texte réel vient de la table `recording_notice_templates`, résolue par pays
 * et par langue via la fonction SQL `resolve_recording_notice()`. Cette
 * constante n'existe que pour le développement hors base et ne doit jamais être
 * lue pendant un appel réel.
 */
export const PLACEHOLDER_NOTICE_TEXT =
  "Bonjour, vous êtes en relation avec l'assistante virtuelle de {{organization}}. " +
  "Cet appel est enregistré afin de traiter votre demande. Vous pouvez vous y opposer " +
  "ou demander à parler directement à un membre de l'équipe.";

/**
 * Un appel doit-il être traité comme un test ?
 *
 * Le drapeau demandé par l'appelant du code ne suffit pas : l'organisation
 * elle-même doit être une organisation d'essai. Sinon l'intention est ignorée et
 * l'appel est traité comme réel (ADR-019).
 *
 * Reproduit `call_is_test()` en base, qui reste la garantie.
 */
export function callIsTest(policy: RecordingPolicy, requestedTest: boolean): boolean {
  return requestedTest && policy.is_test_organization;
}

/**
 * L'enregistrement d'un appel RÉEL est-il autorisé ?
 *
 * Reproduit la logique de la fonction SQL `recording_allowed()`. La base reste
 * la garantie : cette fonction sert à afficher un état correct dans l'interface,
 * pas à décider.
 */
export function isRealRecordingAllowed(
  policy: RecordingPolicy,
  notice: ResolvedNotice | null,
): boolean {
  if (!isRecordingActive(policy)) return false;
  if (!policy.recording_notice_required) return true;
  return notice !== null && notice.isLegallyValidated;
}

/** Ce qu'il manque pour pouvoir enregistrer un appel réel, en clair. */
export function recordingBlockers(
  policy: RecordingPolicy,
  notice: ResolvedNotice | null,
): string[] {
  const blockers: string[] = [];
  if (policy.is_test_organization) {
    return ["Organisation d'essai : aucun appel de tiers réel ne doit y transiter."];
  }
  if (!policy.recording_policy_accepted_at) {
    blockers.push("La charte de traitement des enregistrements n'a pas été acceptée.");
  }
  if (!policy.recording_enabled) {
    blockers.push("L'enregistrement est désactivé pour cette entreprise.");
  }
  if (policy.recording_notice_required && (notice === null || !notice.isLegallyValidated)) {
    blockers.push(
      `Le texte d'annonce applicable est un placeholder ${UNVALIDATED_NOTICE_WARNING}.`,
    );
  }
  return blockers;
}
