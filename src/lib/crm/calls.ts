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

// ---------------------------------------------------------------------------
// Appels sans suite
// ---------------------------------------------------------------------------

/**
 * Seuils de la notion « appel sans suite ».
 *
 * Ces deux nombres sont aussi écrits dans `dashboard_counts()` (migration
 * 0022), parce que le compteur de l'accueil est calculé en base et la liste
 * filtrée ici. Deux endroits pour une même règle, c'est une divergence qui
 * attend son heure : `tests/call-followup.test.ts` échoue si les valeurs ne
 * sont plus les mêmes des deux côtés.
 */
export const SANS_SUITE = {
  /** En dessous, c'est un faux numéro ou un raccrochage, pas un client. */
  DUREE_MINIMUM_SECONDES: 15,
  /** Au-delà, rappeler ne sert plus à rien, et une liste qui ne se vide jamais finit ignorée. */
  FENETRE_JOURS: 7,
} as const;

/** Ce qu'un appel a produit. Les trois compteurs viennent de la base. */
export interface SuitesDAppel {
  leads: number;
  appointments: number;
  tasks: number;
}

export interface AppelPourSuite {
  status: CallStatus;
  is_test: boolean;
  duration_seconds: number | null;
  started_at: string;
}

/**
 * Un appel resté sans suite : la conversation a eu lieu, et rien n'en est
 * sorti — ni demande, ni rendez-vous, ni rappel à passer.
 *
 * C'est le seul endroit du produit où un client peut disparaître sans que
 * personne ne s'en aperçoive : il a appelé, il a parlé, et son appel ne figure
 * que dans une liste que l'artisan n'ouvre pas. D'où sa place sur l'accueil.
 *
 * Une durée inconnue n'est pas traitée comme une durée courte : un appel
 * terminé dont le fournisseur n'a pas rendu la durée est une anomalie, et la
 * masquer reviendrait à perdre le client en silence.
 */
export function sansSuite(
  appel: AppelPourSuite,
  suites: SuitesDAppel,
  maintenant: Date = new Date(),
): boolean {
  if (appel.status !== "COMPLETED") return false;
  if (appel.is_test) return false;
  if (suites.leads > 0 || suites.appointments > 0 || suites.tasks > 0) return false;

  if (appel.duration_seconds !== null && appel.duration_seconds < SANS_SUITE.DUREE_MINIMUM_SECONDES) {
    return false;
  }

  const limite = maintenant.getTime() - SANS_SUITE.FENETRE_JOURS * 24 * 60 * 60 * 1000;
  return new Date(appel.started_at).getTime() > limite;
}

/** Les appels que Sophie n'a pas pu prendre. Un client a entendu sonner dans le vide. */
export function appelEchoue(appel: Pick<AppelPourSuite, "status" | "is_test">): boolean {
  return !appel.is_test && needsAttention(appel.status);
}
