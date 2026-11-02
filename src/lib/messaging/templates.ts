/**
 * Les textes envoyés aux clients.
 *
 * Ils sont courts parce qu'un SMS long est coupé et facturé double, et parce
 * qu'un client lit la première ligne. Ils nomment toujours l'entreprise : un
 * message qui commence par « Votre rendez-vous est confirmé » sans dire par
 * qui ressemble à une arnaque.
 *
 * Ils ne contiennent ni le problème décrit, ni l'adresse : un SMS s'affiche
 * sur un écran verrouillé, parfois devant quelqu'un d'autre.
 */

export type ModeleMessage =
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_CHANGE_PROPOSED"
  | "APPOINTMENT_REJECTED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_REMINDER";

export interface ContexteMessage {
  entreprise: string;
  /** Déjà formatée dans le fuseau de l'entreprise : « mardi 4 novembre à 9:00 ». */
  quand?: string;
  /** Lien de réponse, pour une proposition de nouvel horaire. */
  lien?: string;
  /** Motif, quand le professionnel en a donné un. */
  motif?: string;
}

/** 160 caractères par SMS ; au-delà, l'opérateur découpe et facture plusieurs messages. */
export const LONGUEUR_CONSEILLEE = 160;

export function construireMessage(modele: ModeleMessage, c: ContexteMessage): string {
  const motif = c.motif?.trim() ? ` Motif : ${c.motif.trim()}.` : "";

  switch (modele) {
    case "APPOINTMENT_CONFIRMED":
      return `${c.entreprise} : votre rendez-vous du ${c.quand} est confirmé. À bientôt.`;

    case "APPOINTMENT_CHANGE_PROPOSED":
      return (
        `${c.entreprise} : nous vous proposons le ${c.quand} à la place. ` +
        `Répondez ici : ${c.lien}`
      );

    case "APPOINTMENT_REJECTED":
      return (
        `${c.entreprise} : nous ne pouvons pas assurer le rendez-vous du ${c.quand}.` +
        `${motif} Nous vous recontactons.`
      );

    case "APPOINTMENT_CANCELLED":
      return `${c.entreprise} : votre rendez-vous du ${c.quand} est annulé.${motif}`;

    case "APPOINTMENT_REMINDER":
      return `${c.entreprise} : rappel de votre rendez-vous ${c.quand}.`;
  }
}

/** Date et heure telles qu'un client les lit, dans le fuseau de l'entreprise. */
export function quandLisible(iso: string, timezone = "Europe/Brussels"): string {
  const date = new Date(iso);
  const jour = date.toLocaleDateString("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: timezone,
  });
  const heure = date.toLocaleTimeString("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
  return `${jour} à ${heure}`;
}
