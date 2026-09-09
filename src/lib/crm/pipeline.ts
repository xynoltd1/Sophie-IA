import type { LeadPriority, LeadStatus, TaskRow } from "@/types/database";

/**
 * Pipeline commercial (section 17).
 *
 * Les états internes sont en anglais parce qu'ils sont dans la base ; les
 * libellés affichés sont ceux d'un artisan, pas d'un directeur commercial.
 * « QUALIFIED » ne veut rien dire sur un chantier, « À traiter » si.
 */
export const LEAD_STATUSES: readonly LeadStatus[] = [
  "NEW",
  "QUALIFIED",
  "APPOINTMENT",
  "CUSTOMER",
  "WON",
  "LOST",
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Nouveau",
  QUALIFIED: "À traiter",
  APPOINTMENT: "RDV / Devis",
  CUSTOMER: "Client",
  WON: "Terminé",
  LOST: "Perdu",
};

/** Un prospect clos ne réclame plus rien. */
export function isOpen(status: LeadStatus): boolean {
  return status !== "WON" && status !== "LOST";
}

export const PRIORITY_LABELS: Record<LeadPriority, string> = {
  LOW: "Basse",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgent",
};

/**
 * Transitions autorisées.
 *
 * On peut revenir en arrière — un client change d'avis, un devis est relancé —
 * mais on ne saute pas de « Nouveau » à « Terminé » sans passer par le travail.
 * Rouvrir un prospect perdu est permis : c'est fréquent et légitime.
 */
const TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  NEW: ["QUALIFIED", "APPOINTMENT", "LOST"],
  QUALIFIED: ["NEW", "APPOINTMENT", "CUSTOMER", "LOST"],
  APPOINTMENT: ["QUALIFIED", "CUSTOMER", "WON", "LOST"],
  CUSTOMER: ["APPOINTMENT", "WON", "LOST"],
  WON: ["CUSTOMER"],
  LOST: ["NEW", "QUALIFIED"],
};

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: LeadStatus): readonly LeadStatus[] {
  return TRANSITIONS[from];
}

/** Une tâche est en retard si son échéance est passée et qu'elle est ouverte. */
export function isOverdue(task: Pick<TaskRow, "status" | "due_at">, now = new Date()): boolean {
  if (task.status !== "OPEN" || !task.due_at) return false;
  return new Date(task.due_at) < now;
}

/**
 * Nom affichable d'un contact.
 * Un contact créé pendant un appel n'a parfois qu'un numéro : on affiche alors
 * ce numéro plutôt qu'un « Sans nom » qui n'aide personne à le reconnaître.
 */
export function contactLabel(contact: {
  full_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
}): string {
  const name = contact.full_name?.trim();
  if (name) return name;
  const company = contact.company_name?.trim();
  if (company) return company;
  const phone = contact.phone?.trim();
  if (phone) return phone;
  return "Contact sans nom";
}
