import "server-only";

import { MockAIProvider } from "./mock";
import { OpenAICompatibleProvider } from "./openai";
import type { AIProvider } from "./types";
import { reglages, secret } from "@/lib/config/platform";

export type { AIProvider, AICompletionRequest, AICompletionResult } from "./types";

/**
 * Le fournisseur d'IA configuré, ou la simulation.
 *
 * ## D'où vient la configuration
 *
 * De la base d'abord, de l'environnement ensuite (`lib/config/platform`). La
 * base l'emporte parce que c'est la seule des deux qu'on peut changer sans
 * redéployer.
 *
 * ## Pourquoi c'est devenu asynchrone
 *
 * Lire la base prend un aller-retour. Le cacher derrière une fonction
 * synchrone demanderait un cache toujours chaud, ce qu'une instance Vercel qui
 * démarre à froid ne peut pas garantir. Mieux vaut une signature honnête
 * qu'une promesse qu'on ne tient qu'au deuxième appel.
 *
 * ## Jamais d'exception
 *
 * Une configuration absente ne doit pas faire échouer un webhook d'appel. On
 * renvoie la simulation, qui annonce franchement ce qu'elle est, et l'état de
 * traitement le dit à l'écran.
 */
export async function aiProvider(): Promise<AIProvider> {
  const config = await reglages("ai", {
    provider: process.env.AI_PROVIDER?.trim().toLowerCase() || "mock",
    model: process.env.AI_MODEL?.trim() || "gpt-4.1-mini",
    base_url: process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1",
  });

  const cle = await secret("ai", "api_key", "AI_API_KEY");

  const fournisseur = String(config.provider ?? "mock").toLowerCase();
  if (fournisseur === "mock" || !cle) return new MockAIProvider();

  return new OpenAICompatibleProvider(
    cle,
    String(config.model),
    String(config.base_url),
    fournisseur,
  );
}

/** Vrai quand un vrai fournisseur est configuré. Utilisé par les écrans d'état. */
export async function aiConfigured(): Promise<boolean> {
  return !(await aiProvider()).isMock;
}
