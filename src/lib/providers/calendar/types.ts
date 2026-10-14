/**
 * Abstraction d'un fournisseur d'agenda (section 19).
 *
 * Le domaine métier ne connaît jamais le nom d'un fournisseur. Changer de
 * prestataire ne doit toucher que l'adaptateur qui implémente cette interface.
 *
 * Aucune méthode ne renvoie de jeton : la gestion des jetons appartient à la
 * couche de service, qui seule sait les déchiffrer.
 */

export interface CalendarTokens {
  accessToken: string;
  /** Absent lors d'un rafraîchissement : Google ne le renvoie qu'à la première autorisation. */
  refreshToken?: string;
  expiresAt: Date;
  scope: string;
  /** Adresse du compte autorisé, pour que le professionnel sache ce qu'il a connecté. */
  account?: string;
}

export interface BusyBlock {
  externalEventId: string;
  summary: string | null;
  startsAt: Date;
  endsAt: Date;
  isAllDay: boolean;
  /** `transparent` = l'événement n'occupe pas le professionnel (refusé, ou « disponible »). */
  transparency: "opaque" | "transparent";
  /** Vrai quand l'événement a été supprimé côté fournisseur depuis la dernière synchronisation. */
  deleted: boolean;
}

export interface SyncResult {
  blocks: BusyBlock[];
  /** Jeton pour ne relire que les changements la prochaine fois. */
  nextSyncToken: string | null;
  /** Vrai quand le fournisseur a refusé le jeton incrémental et qu'il faut tout relire. */
  requiresFullSync: boolean;
}

export interface ExternalEventInput {
  title: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  location?: string;
  /** Adresse e-mail du client, s'il doit recevoir l'invitation. */
  attendeeEmail?: string;
}

export interface WatchChannel {
  channelId: string;
  resourceId: string;
  expiresAt: Date;
}

/**
 * Erreur normalisée. Le domaine doit pouvoir distinguer « le service est
 * indisponible » de « l'autorisation a été révoquée » sans connaître les codes
 * d'erreur du fournisseur.
 */
export type CalendarErrorKind =
  | "UNAUTHORIZED" /** jeton révoqué ou invalide : il faut reconnecter */
  | "RATE_LIMITED"
  | "UNAVAILABLE" /** panne ou réseau : réessayer plus tard */
  | "SYNC_TOKEN_EXPIRED"
  | "NOT_FOUND"
  | "INVALID_REQUEST";

export class CalendarError extends Error {
  constructor(
    readonly kind: CalendarErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CalendarError";
  }

  /** Une erreur transitoire mérite un nouvel essai ; les autres non. */
  get retryable(): boolean {
    return this.kind === "RATE_LIMITED" || this.kind === "UNAVAILABLE";
  }
}

export interface CalendarProvider {
  readonly name: string;

  /** URL vers laquelle envoyer le professionnel pour qu'il autorise l'accès. */
  authorizationUrl(state: string): string;

  /** Échange le code reçu au retour d'autorisation contre des jetons. */
  exchangeCode(code: string): Promise<CalendarTokens>;

  refreshTokens(refreshToken: string): Promise<CalendarTokens>;

  /** Révoque l'autorisation côté fournisseur. */
  revoke(token: string): Promise<void>;

  /**
   * Plages occupées. Avec `syncToken`, ne renvoie que les changements ;
   * sans lui, relit la fenêtre complète.
   */
  listBusy(params: {
    accessToken: string;
    calendarId: string;
    from: Date;
    to: Date;
    syncToken?: string | null;
  }): Promise<SyncResult>;

  createEvent(params: {
    accessToken: string;
    calendarId: string;
    event: ExternalEventInput;
  }): Promise<{ externalEventId: string }>;

  updateEvent(params: {
    accessToken: string;
    calendarId: string;
    externalEventId: string;
    event: ExternalEventInput;
  }): Promise<void>;

  deleteEvent(params: {
    accessToken: string;
    calendarId: string;
    externalEventId: string;
  }): Promise<void>;

  /** Abonnement aux notifications de changement. Expire et doit être renouvelé. */
  watch(params: {
    accessToken: string;
    calendarId: string;
    callbackUrl: string;
    channelToken: string;
  }): Promise<WatchChannel>;

  stopWatch(params: {
    accessToken: string;
    channelId: string;
    resourceId: string;
  }): Promise<void>;
}
