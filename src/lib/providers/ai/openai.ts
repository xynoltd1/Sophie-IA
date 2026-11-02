import type { AICompletionRequest, AICompletionResult, AIProvider } from "./types";

/**
 * Adaptateur pour les interfaces compatibles OpenAI.
 *
 * Ce choix couvre, avec le même code, OpenAI, Mistral (européen), Groq,
 * Together, et la plupart des serveurs auto-hébergés : tous exposent
 * `/chat/completions` avec le même format. L'URL de base et le modèle sont des
 * variables d'environnement, donc changer de fournisseur ne demande pas de
 * modifier une ligne de code (ADR-031).
 *
 * Pour une entreprise européenne, Mistral est le choix à retenir le jour où la
 * question des données personnelles devra être tranchée : la transcription
 * d'un appel contient le nom, l'adresse et le problème d'un client.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly isMock = false;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly baseUrl: string,
    readonly name = "openai-compatible",
  ) {}

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    const corps: Record<string, unknown> = {
      model: this.model,
      temperature: request.temperature ?? 0,
      max_tokens: request.maxOutputTokens ?? 700,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
    };

    if (request.json) {
      // `strict: false` est délibéré. En mode strict, l'interface exige que
      // TOUS les champs du schéma figurent dans la réponse, donc le modèle en
      // invente pour satisfaire la contrainte. Or la règle de la section 15 est
      // l'inverse : un champ non entendu doit rester absent.
      corps.response_format = {
        type: "json_schema",
        json_schema: {
          name: request.json.name,
          schema: request.json.schema,
          strict: false,
        },
      };
    }

    let reponse: Response;
    try {
      reponse = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(corps),
        signal: AbortSignal.timeout(45_000),
      });
    } catch (cause) {
      return {
        text: null,
        json: null,
        error:
          cause instanceof Error && cause.name === "TimeoutError"
            ? "Le fournisseur n'a pas répondu en 45 secondes."
            : "Le fournisseur est injoignable.",
        retryable: true,
      };
    }

    if (!reponse.ok) {
      const detail = (await reponse.text()).slice(0, 300);
      return {
        text: null,
        json: null,
        error: `Le fournisseur a répondu ${reponse.status} : ${detail}`,
        // 429 et 5xx passent avec le temps. 401 et 400 ne passeront jamais :
        // réessayer ne ferait que consommer du quota et retarder le diagnostic.
        retryable: reponse.status === 429 || reponse.status >= 500,
      };
    }

    let charge: unknown;
    try {
      charge = await reponse.json();
    } catch {
      return { text: null, json: null, error: "Réponse illisible.", retryable: true };
    }

    const contenu = lireContenu(charge);
    if (contenu === null) {
      return { text: null, json: null, error: "Réponse vide.", retryable: true };
    }

    if (!request.json) {
      return { text: contenu, json: null, usage: lireUsage(charge) };
    }

    const objet = lireJson(contenu);
    if (!objet) {
      return {
        text: contenu,
        json: null,
        error: "La réponse n'est pas un objet JSON exploitable.",
        retryable: true,
      };
    }

    return { text: null, json: objet, usage: lireUsage(charge) };
  }
}

function lireContenu(charge: unknown): string | null {
  const choix = (charge as { choices?: { message?: { content?: unknown } }[] })?.choices;
  const contenu = choix?.[0]?.message?.content;
  if (typeof contenu !== "string") return null;
  const propre = contenu.trim();
  return propre.length > 0 ? propre : null;
}

function lireUsage(charge: unknown): { inputTokens?: number; outputTokens?: number } | undefined {
  const usage = (charge as { usage?: { prompt_tokens?: number; completion_tokens?: number } })
    ?.usage;
  if (!usage) return undefined;
  return { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens };
}

/**
 * Certains modèles encadrent le JSON de texte ou de balises de code, même
 * quand on leur demande un objet. On récupère le premier objet complet plutôt
 * que d'échouer sur un accent de politesse.
 */
export function lireJson(contenu: string): Record<string, unknown> | null {
  const essais = [contenu];

  const sansBalises = contenu.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  if (sansBalises !== contenu) essais.push(sansBalises);

  const debut = contenu.indexOf("{");
  const fin = contenu.lastIndexOf("}");
  if (debut !== -1 && fin > debut) essais.push(contenu.slice(debut, fin + 1));

  for (const essai of essais) {
    try {
      const objet = JSON.parse(essai.trim()) as unknown;
      if (objet && typeof objet === "object" && !Array.isArray(objet)) {
        return objet as Record<string, unknown>;
      }
    } catch {
      /* on tente la forme suivante */
    }
  }
  return null;
}
