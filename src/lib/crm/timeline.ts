/**
 * L'histoire d'un client, tous canaux confondus (section 32).
 *
 * La fiche contact doit répondre à une question : « que s'est-il passé avec
 * cette personne ? ». Quatre tables portent la réponse — appels, messages,
 * rendez-vous, demandes — et aucune ne la contient seule.
 *
 * Cette fonction ne lit rien : elle fusionne et ordonne. Elle est donc
 * testable sans base de données, ce qui compte pour une logique d'affichage
 * qui se trompera d'abord sur l'ordre et les égalités de date.
 */

export type GenreEvenement = "APPEL" | "MESSAGE_RECU" | "MESSAGE_ENVOYE" | "RENDEZ_VOUS" | "DEMANDE";

export interface EvenementFil {
  id: string;
  genre: GenreEvenement;
  /** Instant ISO. Les événements sans date sont écartés : les placer au hasard induirait en erreur. */
  quand: string;
  titre: string;
  detail?: string | null;
  href?: string | null;
}

export interface SourcesFil {
  appels: { id: string; started_at: string; duration_seconds: number | null; status: string }[];
  messages: { id: string; body: string; created_at: string; direction: "INBOUND" | "OUTBOUND"; status?: string }[];
  rendezVous: { id: string; title: string; starts_at: string; status: string }[];
  demandes: { id: string; title: string; created_at: string; status: string }[];
}

const LIBELLES_APPEL: Record<string, string> = {
  COMPLETED: "Appel reçu",
  MISSED: "Appel manqué",
  FAILED: "Appel échoué",
  TRANSFERRED: "Appel transféré",
  RINGING: "Appel en cours",
  ANSWERED: "Appel en cours",
};

export function construireFil(sources: SourcesFil): EvenementFil[] {
  const evenements: EvenementFil[] = [];

  for (const appel of sources.appels) {
    evenements.push({
      id: `appel-${appel.id}`,
      genre: "APPEL",
      quand: appel.started_at,
      titre: LIBELLES_APPEL[appel.status] ?? "Appel",
      detail:
        appel.duration_seconds !== null && appel.duration_seconds > 0
          ? `${Math.round(appel.duration_seconds / 60) || 1} min`
          : null,
      href: `/app/appels/${appel.id}`,
    });
  }

  for (const message of sources.messages) {
    const entrant = message.direction === "INBOUND";
    evenements.push({
      id: `message-${message.id}`,
      genre: entrant ? "MESSAGE_RECU" : "MESSAGE_ENVOYE",
      quand: message.created_at,
      titre: entrant ? "Message reçu" : "Message envoyé",
      detail: message.body.slice(0, 160),
    });
  }

  for (const rdv of sources.rendezVous) {
    evenements.push({
      id: `rdv-${rdv.id}`,
      genre: "RENDEZ_VOUS",
      quand: rdv.starts_at,
      titre: rdv.title,
      detail: rdv.status,
      href: "/app/agenda",
    });
  }

  for (const demande of sources.demandes) {
    evenements.push({
      id: `demande-${demande.id}`,
      genre: "DEMANDE",
      quand: demande.created_at,
      titre: demande.title,
      detail: demande.status,
      href: `/app/prospects/${demande.id}`,
    });
  }

  return evenements
    .filter((e) => !Number.isNaN(new Date(e.quand).getTime()))
    // Du plus récent au plus ancien : ce qu'on cherche sur une fiche client,
    // c'est ce qui vient de se passer.
    .sort((a, b) => new Date(b.quand).getTime() - new Date(a.quand).getTime())
    .slice(0, 50);
}
