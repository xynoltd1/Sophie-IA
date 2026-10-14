/**
 * Abstraction du fournisseur de voix temps réel (section 11).
 *
 * Contrainte d'architecture (ADR-002) : le flux audio ne passe JAMAIS par
 * notre application. Le fournisseur parle au client et, pendant la
 * conversation, appelle nos outils HTTP pour obtenir les vérités métier.
 *
 * Cette interface décrit donc deux choses :
 *  - comment configurer l'assistant chez le fournisseur ;
 *  - comment authentifier et traiter les appels d'outils qu'il nous envoie.
 *
 * Elle ne décrit aucun transport audio, volontairement.
 */

export interface VoiceToolDefinition {
  name: string;
  description: string;
  /** Schéma JSON des paramètres, tel que le fournisseur l'attend. */
  parameters: Record<string, unknown>;
  /** Faux = l'assistant attend la réponse avant de reprendre la parole. */
  async?: boolean;
}

export interface VoiceAssistantConfig {
  organizationId: string;
  assistantName: string;
  language: string;
  voiceId?: string;
  /** Première phrase prononcée au décroché. */
  greeting: string;
  /** Instructions de comportement, construites à partir de la configuration. */
  systemPrompt: string;
  tools: VoiceToolDefinition[];
  /** URL que le fournisseur appellera pour chaque outil et chaque événement. */
  serverUrl: string;
  recordingEnabled: boolean;
  /** Numéro vers lequel transférer si le client demande un humain. */
  transferNumber?: string;
  maxDurationSeconds?: number;
}

export interface VoiceToolCall {
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Identifiant de l'appel chez le fournisseur, pour retrouver notre Call. */
  providerCallId: string;
}

export interface VoiceToolResult {
  toolCallId: string;
  /** Réponse utilisable par l'assistant. Une chaîne convient dans la plupart des cas. */
  result?: string | number | Record<string, unknown>;
  /**
   * Message d'erreur métier.
   *
   * Important : une erreur métier se signale ICI, avec un code HTTP 200. Un
   * code d'erreur HTTP est compris par le fournisseur comme une panne de notre
   * serveur, ce qui coupe la conversation au lieu de la laisser continuer.
   */
  error?: string;
}

export type VoiceEventType =
  | "CALL_STARTED"
  | "CALL_ENDED"
  | "TRANSCRIPT_PARTIAL"
  | "TRANSCRIPT_FINAL"
  | "RECORDING_READY"
  | "TRANSFER_REQUESTED"
  | "ERROR";

export interface VoiceEvent {
  type: VoiceEventType;
  providerCallId: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export interface VoiceAIProvider {
  readonly name: string;

  /** Crée ou met à jour l'assistant d'une organisation chez le fournisseur. */
  upsertAssistant(config: VoiceAssistantConfig): Promise<{ assistantId: string }>;

  /** Associe un numéro de téléphone à un assistant. */
  attachPhoneNumber(params: { assistantId: string; e164: string }): Promise<void>;

  /**
   * Vérifie l'authenticité d'une requête du fournisseur.
   *
   * À appeler avant toute lecture du corps. Doit inclure une protection contre
   * le rejeu (horodatage) quand le fournisseur en fournit une.
   */
  verifyRequest(params: {
    rawBody: string;
    headers: Record<string, string>;
  }): boolean;

  parseToolCall(rawBody: string): VoiceToolCall | null;

  parseEvent(rawBody: string): VoiceEvent | null;

  /** Met en forme la réponse d'outil attendue par le fournisseur. */
  formatToolResponse(results: VoiceToolResult[]): unknown;

  /** Transfert vers un humain, avec résumé quand le fournisseur le permet. */
  transferToHuman(params: {
    providerCallId: string;
    to: string;
    summary?: string;
  }): Promise<void>;

  /** URL temporaire de l'enregistrement, si le fournisseur le conserve. */
  getRecordingUrl(providerCallId: string): Promise<string | null>;
}
