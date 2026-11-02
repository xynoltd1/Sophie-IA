import type { AICompletionRequest, AICompletionResult, AIProvider } from "./types";

/**
 * Fournisseur simulé, pour le développement et les tests.
 *
 * Il ne prétend pas résumer : il renvoie un texte qui annonce franchement ce
 * qu'il est. Un faux résumé plausible serait bien pire qu'une absence de
 * résumé — l'artisan rappellerait un client sur la foi d'un texte inventé.
 *
 * Déterministe : la même transcription donne la même sortie, ce qui rend les
 * tests stables.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly model = "mock";
  readonly isMock = true;

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    const lignes = request.user
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (request.json) {
      // Aucun champ deviné : le mock ne remplit que ce qu'il peut constater.
      return { text: null, json: { intent: "INCONNU" } };
    }

    return {
      text:
        "[SIMULATION] Aucun fournisseur d'intelligence artificielle n'est configuré. " +
        `La transcription compte ${lignes.length} lignes. ` +
        "Renseignez AI_PROVIDER et AI_API_KEY pour obtenir un vrai résumé.",
      json: null,
    };
  }
}
