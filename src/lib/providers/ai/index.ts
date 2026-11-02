import "server-only";

import { MockAIProvider } from "./mock";
import { OpenAICompatibleProvider } from "./openai";
import type { AIProvider } from "./types";

export type { AIProvider, AICompletionRequest, AICompletionResult } from "./types";

/**
 * Le fournisseur d'IA configuré, ou la simulation.
 *
 * Jamais d'exception : une configuration absente ne doit pas faire échouer un
 * webhook d'appel. On renvoie la simulation, qui annonce franchement ce qu'elle
 * est, et l'état de traitement le dit à l'écran.
 */
export function aiProvider(): AIProvider {
  const fournisseur = process.env.AI_PROVIDER?.trim().toLowerCase() || "mock";
  const cle = process.env.AI_API_KEY?.trim();

  if (fournisseur === "mock" || !cle) return new MockAIProvider();

  const modele = process.env.AI_MODEL?.trim() || "gpt-4.1-mini";
  const base = process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1";

  return new OpenAICompatibleProvider(cle, modele, base, fournisseur);
}

/** Vrai quand un vrai fournisseur est configuré. Utilisé par les écrans d'état. */
export function aiConfigured(): boolean {
  return !aiProvider().isMock;
}
