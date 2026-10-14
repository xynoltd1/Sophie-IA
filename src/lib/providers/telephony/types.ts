/**
 * Abstraction d'un opérateur téléphonique (section 10).
 *
 * Responsabilités : posséder les numéros, recevoir les appels, transférer,
 * raccrocher, envoyer les SMS. Le domaine ne connaît jamais le nom de
 * l'opérateur.
 *
 * Ce que cette interface ne fait PAS : porter l'audio de la conversation.
 * Le média va directement de l'opérateur au fournisseur de voix (ADR-002).
 */

export type CallDirection = "INBOUND" | "OUTBOUND";

export type CallStatus =
  | "RINGING"
  | "ANSWERED"
  | "COMPLETED"
  | "MISSED"
  | "FAILED"
  | "TRANSFERRED";

export interface IncomingCall {
  /** Identifiant chez l'opérateur, pour corréler les webhooks suivants. */
  providerCallId: string;
  from: string;
  to: string;
  direction: CallDirection;
  startedAt: Date;
  /** En-têtes SIP bruts : c'est là que se trouve le numéro appelé réel. */
  headers?: Record<string, string>;
}

export interface PhoneNumber {
  e164: string;
  country: string;
  capabilities: { voice: boolean; sms: boolean };
  monthlyPriceCents?: number;
}

export interface TelephonyProvider {
  readonly name: string;

  /**
   * Vérifie la signature d'un webhook entrant.
   *
   * Sans cette vérification, n'importe qui peut prétendre qu'un appel arrive
   * et déclencher nos traitements. À appeler AVANT de lire le corps.
   */
  verifyWebhook(params: {
    rawBody: string;
    headers: Record<string, string>;
    url: string;
  }): boolean;

  parseIncomingCall(rawBody: string): IncomingCall;

  /** Transfère l'appel en cours vers un humain. */
  transfer(params: { providerCallId: string; to: string }): Promise<void>;

  hangup(providerCallId: string): Promise<void>;

  listAvailableNumbers(params: { country: string; limit?: number }): Promise<PhoneNumber[]>;

  provisionNumber(params: { e164: string; organizationId: string }): Promise<PhoneNumber>;
}
