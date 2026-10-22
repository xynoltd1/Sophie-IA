import type { CallStatus, ProcessingStatus } from "@/types/database";

/**
 * Vocabulaire des appels, côté interface.
 *
 * L'artisan ne lit pas des états techniques, il lit ce qui s'est passé. « Appel
 * terminé » et « Sophie n'a pas pu répondre » appellent deux réactions
 * différentes, et c'est cette différence que les libellés doivent porter.
 */
export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  RINGING: "En cours",
  ANSWERED: "En cours",
  COMPLETED: "Terminé",
  MISSED: "Manqué",
  FAILED: "Échec technique",
  TRANSFERRED: "Transféré",
};

/** Les appels qui méritent l'attention du professionnel, pas seulement sa lecture. */
export function needsAttention(status: CallStatus): boolean {
  return status === "MISSED" || status === "FAILED";
}

export function isLive(status: CallStatus): boolean {
  return status === "RINGING" || status === "ANSWERED";
}

/**
 * Ce qu'il faut dire d'un traitement post-appel.
 *
 * `NOT_APPLICABLE` ne s'affiche pas : annoncer « transcription non applicable »
 * à un artisan ne l'informe de rien. Un échec, en revanche, se dit — avec de
 * quoi réessayer (section 16).
 */
export function processingLabel(
  status: ProcessingStatus,
  quoi: string,
): string | null {
  switch (status) {
    case "PENDING":
      return `${quoi} en attente`;
    case "RUNNING":
      return `${quoi} en cours`;
    case "FAILED":
      return `${quoi} indisponible`;
    case "DONE":
    case "NOT_APPLICABLE":
      return null;
  }
}

/** Durée parlée plutôt qu'en secondes : « 2 min 15 », pas « 135 ». */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  if (seconds < 60) return `${seconds} s`;

  const minutes = Math.floor(seconds / 60);
  const reste = seconds % 60;
  return reste === 0 ? `${minutes} min` : `${minutes} min ${reste}`;
}

/** Numéro présentable. Un appel masqué se dit, il ne se devine pas. */
export function formatPhone(e164: string | null): string {
  if (!e164) return "Numéro masqué";
  return e164;
}

export function formatCallMoment(iso: string, timezone = "Europe/Brussels"): string {
  return new Date(iso).toLocaleString("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}
