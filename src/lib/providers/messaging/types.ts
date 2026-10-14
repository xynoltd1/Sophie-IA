/**
 * Abstraction de l'envoi de messages (section 26).
 *
 * SMS aujourd'hui ; WhatsApp et e-mail plus tard, derrière la même interface.
 */

export type MessageChannel = "SMS" | "WHATSAPP" | "EMAIL";

export type MessageStatus = "QUEUED" | "SENT" | "DELIVERED" | "FAILED";

export interface OutboundMessage {
  to: string;
  body: string;
  channel: MessageChannel;
  /** Identifiant métier permettant d'éviter un doublon en cas de nouvel essai. */
  idempotencyKey: string;
}

export interface SendResult {
  status: MessageStatus;
  providerMessageId?: string;
  /**
   * Renseigné en cas d'échec.
   *
   * Un échec d'envoi n'annule jamais le rendez-vous associé (section 26) :
   * l'appelant doit afficher « SMS non envoyé — Réessayer », pas défaire le
   * travail déjà accompli.
   */
  error?: string;
  retryable?: boolean;
}

export interface MessagingProvider {
  readonly name: string;
  readonly supportedChannels: readonly MessageChannel[];

  send(message: OutboundMessage): Promise<SendResult>;

  verifyWebhook(params: { rawBody: string; headers: Record<string, string> }): boolean;

  /** Accusés de réception et changements de statut. */
  parseStatusUpdate(rawBody: string): {
    providerMessageId: string;
    status: MessageStatus;
  } | null;
}
