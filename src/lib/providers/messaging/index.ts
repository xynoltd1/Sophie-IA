import "server-only";

import { MockMessagingProvider } from "./mock";
import { TwilioMessagingProvider } from "./twilio";
import type { MessagingProvider } from "./types";
import { reglages, secret } from "@/lib/config/platform";

export type { MessagingProvider, OutboundMessage, SendResult } from "./types";

/**
 * L'opérateur configuré, ou la simulation.
 *
 * Configuration lue dans la base d'abord, dans l'environnement ensuite. Les
 * trois valeurs doivent être présentes : un opérateur sans expéditeur refuse
 * chaque envoi, et il vaut mieux rester en simulation — qui le dit — que
 * d'échouer message après message.
 *
 * Jamais d'exception : une configuration absente ne doit pas faire échouer la
 * confirmation d'un rendez-vous. Le message reste en file et l'écran dit qu'il
 * n'est pas parti.
 */
export async function messagingProvider(): Promise<MessagingProvider> {
  const config = await reglages("messaging", {
    provider: process.env.MESSAGING_PROVIDER?.trim().toLowerCase() || "mock",
    sender_id: process.env.MESSAGING_SENDER_ID?.trim() || "",
  });

  const nom = String(config.provider ?? "mock").toLowerCase();
  const expediteur = String(config.sender_id ?? "").trim();

  const sid = await secret("messaging", "account_sid", "MESSAGING_ACCOUNT_SID");
  const token = await secret("messaging", "api_key", "MESSAGING_API_KEY");

  if (nom !== "twilio" || !sid || !token || !expediteur) {
    return new MockMessagingProvider();
  }

  return new TwilioMessagingProvider(sid, token, expediteur);
}

export async function messagingConfigured(): Promise<boolean> {
  const fournisseur = await messagingProvider();
  return !("isMock" in fournisseur && fournisseur.isMock);
}
