/**
 * Abstraction du fournisseur d'intelligence artificielle utilisé APRÈS l'appel.
 *
 * À ne pas confondre avec `VoiceAIProvider`, qui tient la conversation en
 * direct. Celui-ci ne parle à personne : il lit une transcription déjà
 * enregistrée et en tire un résumé et des champs structurés.
 *
 * Pourquoi cette abstraction existe plutôt que de se reposer sur le
 * fournisseur de voix : le 23 octobre, ce dernier a accepté notre plan
 * d'analyse, l'a stocké, l'a renvoyé tel quel quand on l'interrogeait — et a
 * exécuté les appels avec `enabled: false`. Trois corrections successives n'y
 * ont rien changé. Une fonction du produit ne peut pas dépendre d'un réglage
 * qu'on ne contrôle pas et dont l'état affiché ne correspond pas à l'état réel.
 */

export interface AISchema {
  /** Nom du schéma, exigé par certains fournisseurs. */
  name: string;
  schema: Record<string, unknown>;
}

export interface AICompletionRequest {
  system: string;
  user: string;
  /** Quand il est fourni, la réponse attendue est un objet JSON conforme. */
  json?: AISchema;
  maxOutputTokens?: number;
  /** 0 par défaut : on veut la même sortie pour la même transcription. */
  temperature?: number;
}

export interface AICompletionResult {
  text: string | null;
  json: Record<string, unknown> | null;
  error?: string;
  /**
   * Vrai quand un nouvel essai a une chance d'aboutir — surcharge, coupure
   * réseau. Faux pour une clé invalide ou une requête refusée : réessayer ne
   * ferait que brûler du quota.
   */
  retryable?: boolean;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  /**
   * Vrai pour un fournisseur simulé.
   *
   * Cette information remonte jusqu'à l'écran : un résumé produit par une
   * simulation est affiché comme tel. Le cahier des charges interdit de faire
   * passer une simulation pour un résultat réel, et le seul moyen de tenir
   * cette promesse est de transporter l'information jusqu'à l'utilisateur.
   */
  readonly isMock: boolean;

  complete(request: AICompletionRequest): Promise<AICompletionResult>;
}
