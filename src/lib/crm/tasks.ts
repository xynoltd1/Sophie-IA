/**
 * Les tâches, côté affichage.
 *
 * Ce module ne touche pas la base : il est importé par un composant client
 * (la liste cochable). Les libellés, les vues et les formats vivent donc ici,
 * et la requête vit dans `tasks-query.ts`, marqué `server-only`. Mélanger les
 * deux ferait entrer le client Supabase dans le paquet envoyé au navigateur.
 */

import type { EntitySource, LeadPriority, TaskStatus } from "@/types/database";

export interface TacheListee {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: LeadPriority;
  status: TaskStatus;
  source: EntitySource;
  completed_at: string | null;
  contact: { id: string; display_name: string } | null;
}

export type VueTaches = "retard" | "aujourdhui" | "ouvertes" | "faites";

export const VUES: Record<VueTaches, string> = {
  retard: "En retard",
  aujourdhui: "Aujourd'hui",
  ouvertes: "À faire",
  faites: "Terminées",
};

export function estVue(valeur: string | undefined): VueTaches {
  if (valeur === "retard" || valeur === "aujourdhui" || valeur === "faites")
    return valeur;
  return "ouvertes";
}

/** Ce qu'on affiche à la place d'une date brute. */
export function echeanceLisible(due: string | null, timezone: string): string {
  if (!due) return "Sans échéance";

  const date = new Date(due);
  const jourTache = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
  }).format(date);
  const jourActuel = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
  }).format(new Date());

  const heure = new Intl.DateTimeFormat("fr-BE", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (jourTache === jourActuel) return `Aujourd'hui ${heure}`;

  return new Intl.DateTimeFormat("fr-BE", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function enRetard(tache: TacheListee): boolean {
  if (tache.status !== "OPEN" || !tache.due_at) return false;
  return new Date(tache.due_at).getTime() < Date.now();
}
