import type { AppointmentStatus } from "@/types/database";

/**
 * Cycle de vie d'un rendez-vous (section 21).
 *
 * Un rendez-vous annulé n'est jamais supprimé : l'historique doit pouvoir
 * répondre à « qu'est-ce qui s'est passé avec ce client ».
 */
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  HELD: "Créneau bloqué",
  PENDING_APPROVAL: "À valider",
  CONFIRMED: "Confirmé",
  CHANGE_PROPOSED: "Nouvel horaire proposé",
  REJECTED: "Refusé",
  CANCELLED: "Annulé",
  COMPLETED: "Terminé",
  NO_SHOW: "Client absent",
};

/** Statuts qui occupent réellement l'agenda. Doit refléter la contrainte SQL. */
const BLOQUANTS: readonly AppointmentStatus[] = [
  "HELD",
  "PENDING_APPROVAL",
  "CONFIRMED",
  "CHANGE_PROPOSED",
];

export function occupiesSlot(status: AppointmentStatus): boolean {
  return BLOQUANTS.includes(status);
}

export function needsApproval(status: AppointmentStatus): boolean {
  return status === "PENDING_APPROVAL";
}

/** Actions proposées au professionnel selon l'état du rendez-vous. */
export function appointmentActions(status: AppointmentStatus): AppointmentStatus[] {
  switch (status) {
    case "PENDING_APPROVAL":
      return ["CONFIRMED", "REJECTED"];
    case "CONFIRMED":
      return ["COMPLETED", "CANCELLED", "NO_SHOW"];
    case "CHANGE_PROPOSED":
      return ["CONFIRMED", "CANCELLED"];
    case "HELD":
      return ["PENDING_APPROVAL", "REJECTED"];
    default:
      return [];
  }
}

/** Heure affichée : « 09:30 ». */
export function formatTime(iso: string, timeZone = "Europe/Brussels"): string {
  return new Date(iso).toLocaleTimeString("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export function formatDay(iso: string, timeZone = "Europe/Brussels"): string {
  return new Date(iso).toLocaleDateString("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  });
}

/** Date du jour au format attendu par un champ date, dans le bon fuseau. */
export function todayISO(timeZone = "Europe/Brussels"): string {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

/** Fin d'un créneau à partir de son début et d'une durée en minutes. */
export function endOfSlot(startIso: string, minutes: number): string {
  return new Date(new Date(startIso).getTime() + minutes * 60_000).toISOString();
}
