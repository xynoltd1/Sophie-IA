import type { BusinessHourRow } from "@/types/database";

/** Jours de la semaine en ISO 8601 : 1 = lundi … 7 = dimanche. */
export const WEEKDAYS = [
  { value: 1, label: "Lundi", short: "Lun" },
  { value: 2, label: "Mardi", short: "Mar" },
  { value: 3, label: "Mercredi", short: "Mer" },
  { value: 4, label: "Jeudi", short: "Jeu" },
  { value: 5, label: "Vendredi", short: "Ven" },
  { value: 6, label: "Samedi", short: "Sam" },
  { value: 7, label: "Dimanche", short: "Dim" },
] as const;

/** Postgres renvoie "08:00:00" ; l'interface veut "08:00". */
export function toInputTime(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

export interface HourInput {
  weekday: number;
  is_open: boolean;
  opens_at: string;
  closes_at: string;
}

/**
 * Valide une grille d'horaires avant enregistrement.
 * Renvoie un message par jour en défaut, vide si tout est cohérent.
 */
export function validateHours(hours: HourInput[]): Record<number, string> {
  const errors: Record<number, string> = {};

  for (const hour of hours) {
    if (!hour.is_open) continue;

    if (!hour.opens_at || !hour.closes_at) {
      errors[hour.weekday] = "Indiquez une heure d'ouverture et de fermeture.";
      continue;
    }
    if (hour.opens_at >= hour.closes_at) {
      errors[hour.weekday] = "La fermeture doit être après l'ouverture.";
    }
  }

  return errors;
}

/** Une entreprise fermée toute la semaine ne peut recevoir aucun rendez-vous. */
export function isEveryDayClosed(hours: HourInput[]): boolean {
  return hours.every((hour) => !hour.is_open);
}

export function summarize(hours: BusinessHourRow[]): string {
  const open = hours.filter((hour) => hour.is_open);
  if (open.length === 0) return "Aucun jour d'ouverture défini";

  const labels = open
    .map((hour) => WEEKDAYS.find((day) => day.value === hour.weekday)?.short)
    .filter(Boolean);

  return `${labels.join(", ")} — ${open.length} jour${open.length > 1 ? "s" : ""} par semaine`;
}
