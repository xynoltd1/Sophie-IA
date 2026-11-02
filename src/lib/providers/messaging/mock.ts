import type { MessagingProvider, OutboundMessage, SendResult } from "./types";

/**
 * Fournisseur de messages simulé.
 *
 * Il n'envoie rien et le dit. Le message reste en file avec un statut qui
 * l'indique, et l'interface affiche que le SMS n'est pas parti : le cahier des
 * charges interdit de prétendre qu'un SMS a été envoyé (section 2.2).
 */
export class MockMessagingProvider implements MessagingProvider {
  readonly name = "mock";
  readonly supportedChannels = ["SMS"] as const;
  readonly isMock = true;

  async send(message: OutboundMessage): Promise<SendResult> {
    console.info("[messagerie simulée] message non envoyé", {
      to: message.to,
      taille: message.body.length,
    });
    return {
      status: "FAILED",
      error:
        "Aucun opérateur SMS n'est configuré. Le message est conservé et partira " +
        "dès qu'un compte sera renseigné.",
      retryable: true,
    };
  }

  verifyWebhook(): boolean {
    return false;
  }

  parseStatusUpdate(): null {
    return null;
  }
}
