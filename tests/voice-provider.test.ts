import { beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";

/**
 * Adaptateur du fournisseur de voix.
 *
 * Ces tests couvrent la partie du spike technique qui ne demande aucun compte :
 * l'authentification des requêtes entrantes et le décodage des appels d'outils.
 * Ce sont aussi les deux endroits où une erreur serait la plus grave — une
 * signature mal vérifiée ouvre l'agenda de toutes les entreprises.
 */

const SECRET = "secret-de-test-pour-la-signature";

beforeAll(() => {
  process.env.VOICE_WEBHOOK_SECRET = SECRET;
});

function signer(body: string, timestamp?: number): Record<string, string> {
  const message = timestamp ? `${timestamp}.${body}` : body;
  return {
    "x-vapi-signature": createHmac("sha256", SECRET).update(message).digest("hex"),
    ...(timestamp ? { "x-vapi-timestamp": String(timestamp) } : {}),
  };
}

describe("authentification des requêtes du fournisseur de voix", () => {
  it("accepte une signature valide", async () => {
    const { VapiVoiceProvider } = await import("@/lib/providers/voice/vapi");
    const provider = new VapiVoiceProvider();
    const body = JSON.stringify({ message: { type: "tool-calls" } });

    expect(provider.verifyRequest({ rawBody: body, headers: signer(body) })).toBe(true);
  });

  it("refuse une signature forgée", async () => {
    const { VapiVoiceProvider } = await import("@/lib/providers/voice/vapi");
    const provider = new VapiVoiceProvider();

    expect(
      provider.verifyRequest({
        rawBody: "{}",
        headers: { "x-vapi-signature": "a".repeat(64) },
      }),
    ).toBe(false);
  });

  it("refuse un corps modifié après signature", async () => {
    const { VapiVoiceProvider } = await import("@/lib/providers/voice/vapi");
    const provider = new VapiVoiceProvider();
    const original = JSON.stringify({ message: { type: "tool-calls", org: "victime" } });
    const headers = signer(original);
    const altere = JSON.stringify({ message: { type: "tool-calls", org: "attaquant" } });

    expect(provider.verifyRequest({ rawBody: altere, headers })).toBe(false);
  });

  it("refuse une requête rejouée trop tard", async () => {
    const { VapiVoiceProvider } = await import("@/lib/providers/voice/vapi");
    const provider = new VapiVoiceProvider();
    const body = "{}";
    const vieux = Date.now() - 60 * 60 * 1000;

    // Signature parfaitement valide, mais vieille d'une heure : c'est le cas
    // du rejeu, et il doit être refusé.
    expect(provider.verifyRequest({ rawBody: body, headers: signer(body, vieux) })).toBe(false);
  });

  it("accepte une requête horodatée récente", async () => {
    const { VapiVoiceProvider } = await import("@/lib/providers/voice/vapi");
    const provider = new VapiVoiceProvider();
    const body = "{}";

    expect(
      provider.verifyRequest({ rawBody: body, headers: signer(body, Date.now()) }),
    ).toBe(true);
  });

  it("refuse une requête sans aucune preuve d'origine", async () => {
    const { VapiVoiceProvider } = await import("@/lib/providers/voice/vapi");
    const provider = new VapiVoiceProvider();

    expect(provider.verifyRequest({ rawBody: "{}", headers: {} })).toBe(false);
  });

  it("ne dépend pas de la casse des en-têtes", async () => {
    const { VapiVoiceProvider } = await import("@/lib/providers/voice/vapi");
    const provider = new VapiVoiceProvider();
    const body = "{}";
    const signature = createHmac("sha256", SECRET).update(body).digest("hex");

    expect(
      provider.verifyRequest({ rawBody: body, headers: { "X-Vapi-Signature": signature } }),
    ).toBe(true);
  });
});

describe("décodage des appels d'outils", () => {
  it("lit un appel d'outil complet", async () => {
    const { VapiVoiceProvider } = await import("@/lib/providers/voice/vapi");
    const provider = new VapiVoiceProvider();

    const appel = provider.parseToolCall(
      JSON.stringify({
        message: {
          type: "tool-calls",
          call: { id: "call-123" },
          toolCalls: [
            {
              id: "tc-1",
              function: { name: "check_availability", arguments: '{"date":"2026-10-01"}' },
            },
          ],
        },
      }),
    );

    expect(appel).toMatchObject({
      toolCallId: "tc-1",
      name: "check_availability",
      providerCallId: "call-123",
    });
    expect(appel?.arguments).toEqual({ date: "2026-10-01" });
  });

  it("accepte des arguments déjà décodés", async () => {
    const { VapiVoiceProvider } = await import("@/lib/providers/voice/vapi");
    const provider = new VapiVoiceProvider();

    const appel = provider.parseToolCall(
      JSON.stringify({
        message: {
          type: "tool-calls",
          call: { id: "c" },
          toolCalls: [{ id: "tc", function: { name: "x", arguments: { a: 1 } } }],
        },
      }),
    );

    expect(appel?.arguments).toEqual({ a: 1 });
  });

  it("ne confond pas un événement avec un appel d'outil", async () => {
    const { VapiVoiceProvider } = await import("@/lib/providers/voice/vapi");
    const provider = new VapiVoiceProvider();

    expect(
      provider.parseToolCall(JSON.stringify({ message: { type: "end-of-call-report" } })),
    ).toBeNull();
  });

  it("survit à une charge utile illisible", async () => {
    const { VapiVoiceProvider } = await import("@/lib/providers/voice/vapi");
    const provider = new VapiVoiceProvider();

    expect(provider.parseToolCall("pas du json")).toBeNull();
    expect(provider.parseEvent("pas du json")).toBeNull();
  });
});

describe("mise en forme des réponses d'outil", () => {
  it("renvoie un résultat exploitable par l'assistant", async () => {
    const { VapiVoiceProvider } = await import("@/lib/providers/voice/vapi");
    const provider = new VapiVoiceProvider();

    expect(
      provider.formatToolResponse([{ toolCallId: "tc-1", result: "9h, 11h, 14h" }]),
    ).toEqual({ results: [{ toolCallId: "tc-1", result: "9h, 11h, 14h" }] });
  });

  it("transmet une erreur métier sans la transformer en panne", async () => {
    const { VapiVoiceProvider } = await import("@/lib/providers/voice/vapi");
    const provider = new VapiVoiceProvider();

    const reponse = provider.formatToolResponse([
      { toolCallId: "tc-1", error: "Date invalide." },
    ]) as { results: Array<Record<string, unknown>> };

    // L'erreur voyage dans le corps, avec un code HTTP 200 côté endpoint :
    // Sophie peut le dire au client au lieu de voir l'appel se couper.
    expect(reponse.results[0]).toEqual({ toolCallId: "tc-1", error: "Date invalide." });
    expect(reponse.results[0]).not.toHaveProperty("result");
  });
});

describe("catalogue d'outils", () => {
  it("expose check_availability avec un schéma utilisable", async () => {
    const { findTool, toolDefinitions } = await import("@/lib/sophie/tools");

    const outil = findTool("check_availability");
    expect(outil).toBeDefined();

    const params = outil?.definition.parameters as { required?: string[] };
    expect(params.required).toContain("date");

    // Chaque outil doit se décrire, sinon le modèle ne sait pas quand l'appeler.
    for (const definition of toolDefinitions()) {
      expect(definition.description.length).toBeGreaterThan(20);
    }
  });

  it("ignore un outil inconnu", async () => {
    const { findTool } = await import("@/lib/sophie/tools");
    expect(findTool("supprimer_tout")).toBeUndefined();
  });
});
