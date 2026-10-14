/**
 * Abstraction de la transcription et de l'analyse post-appel (sections 14 et 15).
 *
 * Trois productions distinctes, dans cet ordre de priorité : l'audio original,
 * la transcription, puis le résumé et l'extraction. Un échec d'une étape ne
 * doit jamais détruire les précédentes.
 */

export interface TranscriptSegment {
  speaker: "SOPHIE" | "CUSTOMER" | "UNKNOWN";
  text: string;
  /** Millisecondes depuis le début de l'appel, quand le fournisseur les donne. */
  startMs?: number;
  endMs?: number;
  confidence?: number;
}

export interface Transcript {
  segments: TranscriptSegment[];
  language: string;
  durationMs?: number;
}

/**
 * Extraction structurée (section 15).
 *
 * Tout champ inconnu reste `null`. On n'invente jamais une valeur pour
 * remplir une case : une adresse hallucinée envoie un artisan au mauvais
 * endroit.
 */
export interface CallExtraction {
  intent: string | null;
  service: string | null;
  urgency: "NONE" | "LOW" | "HIGH" | "CRITICAL" | null;
  customerName: string | null;
  address: string | null;
  requestedDate: string | null;
  requestedTime: string | null;
  problemDescription: string | null;
  appointmentRequested: boolean | null;
  callbackRequested: boolean | null;
  /** Confiance globale, entre 0 et 1, pour signaler une extraction douteuse. */
  confidence: number | null;
}

export interface TranscriptionProvider {
  readonly name: string;

  transcribe(params: {
    audioUrl: string;
    language: string;
  }): Promise<Transcript>;

  summarize(params: {
    transcript: Transcript;
    /** Contexte métier, pour que le résumé emploie le vocabulaire du métier. */
    businessContext: string;
  }): Promise<string>;

  extract(params: {
    transcript: Transcript;
    availableServices: string[];
  }): Promise<CallExtraction>;
}
