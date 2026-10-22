import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  VoiceAIProvider,
  VoiceAssistantConfig,
  VoiceEvent,
  VoiceEventType,
  VoiceToolCall,
  VoiceToolResult,
} from "./types";

/**
 * Adaptateur Vapi (ADR-020).
 *
 * Il ne transporte aucun audio : Vapi parle au client, et appelle nos outils
 * HTTP pendant la conversation. Ce fichier ne contient donc que de la
 * vérification de signature, du décodage de charge utile et de la mise en
 * forme de réponses.
 */

// Par défaut la région américaine : l'Europe de Vapi n'est pas accessible en
// libre-service (ADR-026), et un défaut qui pointe vers une région inaccessible
// produit un « 401 unauthorized » que rien n'explique.
const API = process.env.VOICE_API_BASE_URL?.trim() || "https://api.vapi.ai";

/** Au-delà, une requête rejouée est refusée même si sa signature est valide. */
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

interface VapiToolCallPayload {
  message?: {
    type?: string;
    toolCalls?: Array<{
      id: string;
      function?: { name?: string; arguments?: unknown };
    }>;
    call?: { id?: string };
    timestamp?: number;
  };
}

interface VapiEventPayload {
  message?: {
    type?: string;
    call?: { id?: string };
    timestamp?: number;
    transcript?: string;
    role?: string;
    recordingUrl?: string;
    endedReason?: string;
  };
}

/** Types d'événements Vapi vers nos propres types. */
const EVENT_MAP: Record<string, VoiceEventType> = {
  "status-update": "CALL_STARTED",
  "end-of-call-report": "CALL_ENDED",
  transcript: "TRANSCRIPT_FINAL",
  "speech-update": "TRANSCRIPT_PARTIAL",
  "transfer-destination-request": "TRANSFER_REQUESTED",
};

export class VapiVoiceProvider implements VoiceAIProvider {
  readonly name = "VAPI";

  private secret(): string {
    const secret = process.env.VOICE_WEBHOOK_SECRET?.trim();
    if (!secret) {
      throw new Error(
        "VOICE_WEBHOOK_SECRET manquante. Sans elle, impossible de distinguer un appel " +
          "de Vapi d'une requête forgée.",
      );
    }
    return secret;
  }

  private apiKey(): string {
    const key = process.env.VOICE_API_KEY?.trim();
    if (!key) throw new Error("VOICE_API_KEY manquante.");
    return key;
  }

  /**
   * Authentifie une requête entrante.
   *
   * Deux modes, dans cet ordre de préférence :
   *  - HMAC SHA-256 du corps brut, avec horodatage contre le rejeu ;
   *  - secret partagé en clair dans un en-tête, si le HMAC n'est pas configuré.
   *
   * Le corps DOIT être le texte brut reçu. Un corps re-sérialisé depuis un
   * objet JSON produit une signature différente : espaces, ordre des clés,
   * échappement des caractères.
   */
  verifyRequest(params: { rawBody: string; headers: Record<string, string> }): boolean {
    const headers = normalizeHeaders(params.headers);
    const secret = this.secret();

    const signature = headers["x-vapi-signature"] ?? headers["x-signature"];

    if (signature) {
      const timestamp = headers["x-vapi-timestamp"] ?? headers["x-timestamp"];

      if (timestamp) {
        const age = Math.abs(Date.now() - Number(timestamp));
        if (!Number.isFinite(age) || age > MAX_SIGNATURE_AGE_MS) return false;
      }

      // Quand un horodatage accompagne la requête, il fait partie du message
      // signé : sans cela, rejouer une requête ancienne resterait possible.
      const message = timestamp ? `${timestamp}.${params.rawBody}` : params.rawBody;
      const attendu = createHmac("sha256", secret).update(message).digest("hex");

      return safeEqual(signature.replace(/^sha256=/, ""), attendu);
    }

    const partage = headers["x-vapi-secret"];
    if (partage) return safeEqual(partage, secret);

    return false;
  }

  parseToolCall(rawBody: string): VoiceToolCall | null {
    let payload: VapiToolCallPayload;
    try {
      payload = JSON.parse(rawBody) as VapiToolCallPayload;
    } catch {
      return null;
    }

    const message = payload.message;
    if (message?.type !== "tool-calls") return null;

    const appel = message.toolCalls?.[0];
    if (!appel?.id || !appel.function?.name) return null;

    // Vapi envoie parfois les arguments sous forme de chaîne JSON, parfois
    // comme objet déjà décodé.
    let args: Record<string, unknown> = {};
    const brut = appel.function.arguments;
    if (typeof brut === "string") {
      try {
        args = JSON.parse(brut) as Record<string, unknown>;
      } catch {
        args = {};
      }
    } else if (brut && typeof brut === "object") {
      args = brut as Record<string, unknown>;
    }

    return {
      toolCallId: appel.id,
      name: appel.function.name,
      arguments: args,
      providerCallId: message.call?.id ?? "",
    };
  }

  parseEvent(rawBody: string): VoiceEvent | null {
    let payload: VapiEventPayload;
    try {
      payload = JSON.parse(rawBody) as VapiEventPayload;
    } catch {
      return null;
    }

    const message = payload.message;
    const type = message?.type ? EVENT_MAP[message.type] : undefined;
    if (!type || !message) return null;

    return {
      type,
      providerCallId: message.call?.id ?? "",
      occurredAt: message.timestamp ? new Date(message.timestamp) : new Date(),
      payload: {
        transcript: message.transcript,
        role: message.role,
        recordingUrl: message.recordingUrl,
        endedReason: message.endedReason,
      },
    };
  }

  formatToolResponse(results: VoiceToolResult[]): unknown {
    return {
      results: results.map((result) => ({
        toolCallId: result.toolCallId,
        ...(result.error ? { error: result.error } : { result: result.result ?? "" }),
      })),
    };
  }

  async upsertAssistant(config: VoiceAssistantConfig): Promise<{ assistantId: string }> {
    const response = await fetch(`${API}/assistant`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: `${config.assistantName} — ${config.organizationId}`,
        firstMessage: config.greeting,
        model: {
          provider: "openai",
          model: "gpt-4o",
          messages: [{ role: "system", content: config.systemPrompt }],
          tools: config.tools.map((tool) => ({
            type: "function",
            async: tool.async ?? false,
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
            server: { url: config.serverUrl, timeoutSeconds: 20 },
          })),
        },
        voice: config.voiceId
          ? { provider: "azure", voiceId: config.voiceId }
          : { provider: "azure", voiceId: "fr-FR-DeniseNeural" },
        transcriber: { provider: "deepgram", model: "nova-3", language: config.language },
        artifactPlan: { recordingEnabled: config.recordingEnabled },
        maxDurationSeconds: config.maxDurationSeconds ?? 900,
        metadata: { organizationId: config.organizationId },
        server: { url: config.serverUrl },
      }),
    });

    if (!response.ok) {
      throw new Error(`Vapi a refusé la configuration : ${await response.text()}`);
    }

    const data = (await response.json()) as { id: string };
    return { assistantId: data.id };
  }

  async attachPhoneNumber(params: { assistantId: string; e164: string }): Promise<void> {
    const response = await fetch(`${API}/phone-number`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${this.apiKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ number: params.e164, assistantId: params.assistantId }),
    });

    if (!response.ok) {
      throw new Error(`Association du numéro refusée : ${await response.text()}`);
    }
  }

  async transferToHuman(params: {
    providerCallId: string;
    to: string;
    summary?: string;
  }): Promise<void> {
    const response = await fetch(`${API}/call/${params.providerCallId}/transfer`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        destination: { type: "number", number: params.to },
        // Le transfert avec résumé annonce le contexte au professionnel avant
        // de lui passer le client (section 27).
        mode: params.summary ? "warm-transfer-say-summary" : "blind-transfer",
        ...(params.summary ? { summary: params.summary } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`Transfert refusé : ${await response.text()}`);
    }
  }

  async getRecordingUrl(providerCallId: string): Promise<string | null> {
    const response = await fetch(`${API}/call/${providerCallId}`, {
      headers: { authorization: `Bearer ${this.apiKey()}` },
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { artifact?: { recordingUrl?: string } };
    return data.artifact?.recordingUrl ?? null;
  }
}

function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key.toLowerCase()] = value;
  }
  return result;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
