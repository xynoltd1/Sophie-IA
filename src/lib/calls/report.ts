/**
 * Lecture du rapport de fin d'appel.
 *
 * Ce fichier ne parle à rien : il traduit un objet JSON en données métier. Tout
 * y est défensif, pour une raison précise. La forme exacte du rapport n'est pas
 * garantie : elle varie selon la version du fournisseur, selon que l'appel
 * vient d'un numéro ou du navigateur, et la documentation est en retard sur le
 * produit. Ce projet a déjà perdu une matinée sur un adaptateur écrit contre
 * une API devinée.
 *
 * La règle est donc : chercher la valeur à tous les endroits connus, et quand
 * elle est introuvable, renvoyer `null` plutôt qu'une valeur plausible. Un
 * résumé absent s'affiche comme absent ; un résumé inventé ment.
 *
 * Le rapport brut est conservé en base (`call_events`), ce qui permet de
 * rejouer cette lecture après l'avoir corrigée, sans rien redemander au
 * fournisseur.
 */

export type Speaker = "SOPHIE" | "CLIENT" | "SYSTEME";

export interface SegmentTranscription {
  ordinal: number;
  speaker: Speaker;
  content: string;
  /** Millisecondes depuis le début de l'appel, ou null si le fournisseur ne les donne pas. */
  startedMs: number | null;
  endedMs: number | null;
}

export interface RapportFinAppel {
  segments: SegmentTranscription[];
  resume: string | null;
  audioUrl: string | null;
  donnees: Record<string, unknown> | null;
  /** La transcription en bloc, quand elle existe. Secours si les messages manquent. */
  transcriptBrut: string | null;
}

type Inconnu = Record<string, unknown>;

function objet(valeur: unknown): Inconnu | null {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)
    ? (valeur as Inconnu)
    : null;
}

/** Suit un chemin pointé sans jamais lever, quel que soit l'objet reçu. */
function chemin(racine: unknown, route: string): unknown {
  let courant: unknown = racine;
  for (const cle of route.split(".")) {
    const o = objet(courant);
    if (!o) return undefined;
    courant = o[cle];
  }
  return courant;
}

/** La première valeur non vide parmi plusieurs chemins possibles. */
function premier(racine: unknown, routes: string[]): unknown {
  for (const route of routes) {
    const valeur = chemin(racine, route);
    if (valeur !== undefined && valeur !== null && valeur !== "") return valeur;
  }
  return undefined;
}

function texteOuNull(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const propre = valeur.trim();
  return propre.length > 0 ? propre : null;
}

function nombreOuNull(valeur: unknown): number | null {
  const n = typeof valeur === "number" ? valeur : Number(valeur);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Les intervenants
// ---------------------------------------------------------------------------

/**
 * `bot` est Sophie, `user` est l'appelant. Le reste — instruction de départ,
 * appels d'outils, résultats d'outils — n'est pas de la conversation et n'a
 * rien à faire dans une transcription lue par un artisan. Ces lignes sont
 * écartées plutôt que rangées sous `SYSTEME` : l'instruction de départ est le
 * prompt complet de Sophie, inutile ici et volumineux à chaque appel.
 */
function speakerDepuisRole(role: unknown): Speaker | null {
  switch (typeof role === "string" ? role.toLowerCase() : "") {
    case "bot":
    case "assistant":
      return "SOPHIE";
    case "user":
    case "customer":
      return "CLIENT";
    default:
      return null;
  }
}

/** Les millisecondes d'un message, à partir des champs réellement observés. */
function bornes(message: Inconnu): { startedMs: number | null; endedMs: number | null } {
  const secondes = nombreOuNull(message.secondsFromStart);
  const startedMs = secondes === null ? null : Math.max(0, Math.round(secondes * 1000));

  if (startedMs === null) return { startedMs: null, endedMs: null };

  // `duration` est en millisecondes ; `time` et `endTime` sont des instants
  // absolus. On n'additionne que des grandeurs de même nature.
  const duree = nombreOuNull(message.duration);
  if (duree !== null && duree >= 0) return { startedMs, endedMs: startedMs + Math.round(duree) };

  const debut = nombreOuNull(message.time);
  const fin = nombreOuNull(message.endTime);
  if (debut !== null && fin !== null && fin >= debut) {
    return { startedMs, endedMs: startedMs + Math.round(fin - debut) };
  }

  return { startedMs, endedMs: null };
}

export function segmentsDepuisMessages(messages: unknown): SegmentTranscription[] {
  if (!Array.isArray(messages)) return [];

  const segments: SegmentTranscription[] = [];

  for (const brut of messages) {
    const message = objet(brut);
    if (!message) continue;

    const speaker = speakerDepuisRole(message.role);
    if (!speaker) continue;

    const content = texteOuNull(message.message) ?? texteOuNull(message.content);
    if (!content) continue;

    const { startedMs, endedMs } = bornes(message);
    segments.push({ ordinal: segments.length, speaker, content, startedMs, endedMs });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Le rapport complet
// ---------------------------------------------------------------------------

const CHEMINS_MESSAGES = [
  "message.artifact.messages",
  "message.messages",
  "artifact.messages",
  "messages",
];

const CHEMINS_RESUME = [
  "message.analysis.summary",
  "message.summary",
  "analysis.summary",
  "message.artifact.summary",
];

/**
 * L'ordre compte, et il a été payé.
 *
 * `message.recordingUrl` est l'adresse BRUTE du fichier chez l'hébergeur du
 * fournisseur. Elle n'est pas signée : la demander renvoie une erreur 400.
 * C'est exactement ce qui est arrivé le 23 octobre, et l'erreur ne disait rien
 * d'autre que « le fournisseur a répondu 400 ».
 *
 * Les adresses `presigned...` sont les seules téléchargeables. Elles expirent
 * (`presignedUrlsExpiresAt`), d'où le rapatriement immédiat.
 *
 * Mono d'abord : c'est la conversation mixée sur une seule piste, deux fois
 * plus légère que la stéréo, et c'est ce qu'un artisan veut écouter. La stéréo
 * sépare les deux interlocuteurs — utile un jour, inutile aujourd'hui.
 */
const CHEMINS_AUDIO = [
  "message.artifact.presignedMonoUrl",
  "message.artifact.presignedStereoUrl",
  "message.artifact.recording.mono.combinedUrl",
  "message.artifact.recording.stereoUrl",
  "message.artifact.recording.url",
  // Adresses non signées, gardées en dernier recours : certaines versions du
  // fournisseur les rendent publiques, d'autres non.
  "message.artifact.recordingUrl",
  "message.recordingUrl",
  "message.artifact.stereoRecordingUrl",
  "artifact.recordingUrl",
];

const CHEMINS_TRANSCRIPT = [
  "message.artifact.transcript",
  "message.transcript",
  "artifact.transcript",
];

const CHEMINS_DONNEES = [
  "message.analysis.structuredData",
  "analysis.structuredData",
  "message.structuredData",
];

export function lireRapport(payload: unknown): RapportFinAppel {
  const messages = premier(payload, CHEMINS_MESSAGES);

  return {
    segments: segmentsDepuisMessages(messages),
    resume: texteOuNull(premier(payload, CHEMINS_RESUME)),
    audioUrl: texteOuNull(premier(payload, CHEMINS_AUDIO)),
    donnees: objet(premier(payload, CHEMINS_DONNEES)),
    transcriptBrut: texteOuNull(premier(payload, CHEMINS_TRANSCRIPT)),
  };
}

/**
 * Ce qu'on dit de chaque traitement après lecture du rapport.
 *
 * `DONE` quand la donnée est là. `FAILED` quand l'appel a eu lieu et que la
 * donnée manque : c'est un échec réessayable, pas une absence normale, et
 * l'interface doit proposer de réessayer (section 16).
 */
export type EtatTraitement = "NOT_APPLICABLE" | "PENDING" | "DONE" | "FAILED";

export function etatsDepuisRapport(
  rapport: RapportFinAppel,
  options: { enregistrementAutorise: boolean },
): {
  transcription: EtatTraitement;
  resume: EtatTraitement;
  enregistrement: EtatTraitement;
} {
  const aTranscription = rapport.segments.length > 0 || rapport.transcriptBrut !== null;

  return {
    transcription: aTranscription ? "DONE" : "FAILED",
    resume: rapport.resume ? "DONE" : "FAILED",
    // Sans autorisation d'enregistrer, il n'y a pas d'échec : il n'y a rien à
    // faire. La nuance compte, elle est juridique (section 42).
    enregistrement: !options.enregistrementAutorise
      ? "NOT_APPLICABLE"
      : rapport.audioUrl
        ? "PENDING"
        : "FAILED",
  };
}
