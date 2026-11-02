import "server-only";

import { MockMessagingProvider } from "./mock";
import { TwilioMessagingProvider } from "./twilio";
import type { MessagingProvider } from "./types";

export type { MessagingProvider, OutboundMessage, SendResult } from "./types";

/**
 * L'opérateur configuré, ou la simulation.
 *
 * Jamais d'exception : une configuration absente ne doit pas faire échouer la
 * confirmation d'un rendez-vous. Le message reste en file et l'écran dit qu'il
 * n'est pas parti.
 */
export function messagingProvider(): MessagingProvider {
  const nom = process.env.MESSAGING_PROVIDER?.trim().toLowerCase() || "mock";
  const sid = process.env.MESSAGING_ACCOUNT_SID?.trim();
  const token = process.env.MESSAGING_API_KEY?.trim();
  const expediteur = process.env.MESSAGING_SENDER_ID?.trim();

  if (nom !== "twilio" || !sid || !token || !expediteur) {
    return new MockMessagingProvider();
  }

  return new TwilioMessagingProvider(sid, token, expediteur);
}

export function messagingConfigured(): boolean {
  return !("isMock" in messagingProvider() && messagingProvider().isMock);
}
