import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VapiVoiceProvider } from "@/lib/providers/voice/vapi";
import { findTool } from "@/lib/sophie/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

/**
 * Endpoint d'outils appelé par le fournisseur de voix PENDANT un appel.
 *
 * C'est le point de contact de l'architecture décidée en ADR-002 : l'audio ne
 * passe pas par ici, seulement des questions métier courtes.
 *
 * Trois règles, dans cet ordre :
 *
 * 1. **Vérifier la signature avant de lire le corps.** Sans cela, n'importe qui
 *    peut interroger l'agenda de n'importe quelle entreprise.
 *
 * 2. **Répondre 200 même en cas d'erreur métier.** Un code d'erreur HTTP est
 *    compris par le fournisseur comme une panne de notre serveur : il coupe la
 *    conversation. Une erreur métier se signale dans le champ `error`, ce qui
 *    permet à Sophie de dire au client qu'elle ne peut pas répondre, sans
 *    raccrocher.
 *
 * 3. **Ne jamais faire confiance à l'organisation annoncée par le modèle.** Elle
 *    est lue depuis la configuration de l'assistant, que nous avons créée
 *    nous-mêmes, et jamais depuis les arguments de l'outil.
 */
export async function POST(request: NextRequest) {
  // Le corps brut, et non un objet re-sérialisé : la signature porte sur les
  // octets exacts reçus.
  const rawBody = await request.text();

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const provider = new VapiVoiceProvider();

  let authentique = false;
  try {
    authentique = provider.verifyRequest({ rawBody, headers });
  } catch {
    // Secret non configuré : on refuse plutôt que d'accepter par défaut.
    authentique = false;
  }

  if (!authentique) {
    return new NextResponse("signature invalide", { status: 401 });
  }

  const appel = provider.parseToolCall(rawBody);
  if (!appel) {
    return new NextResponse("charge utile non reconnue", { status: 400 });
  }

  const organizationId = await resolveOrganization(rawBody, appel.providerCallId);

  if (!organizationId) {
    return NextResponse.json(
      provider.formatToolResponse([
        {
          toolCallId: appel.toolCallId,
          error:
            "Entreprise introuvable pour cet appel. Prenez les coordonnées du client et " +
            "dites que le professionnel le rappellera.",
        },
      ]),
    );
  }

  const outil = findTool(appel.name);
  if (!outil) {
    return NextResponse.json(
      provider.formatToolResponse([
        { toolCallId: appel.toolCallId, error: `Outil inconnu : ${appel.name}.` },
      ]),
    );
  }

  const admin = createAdminClient();

  const { data: estTest } = await admin.rpc("call_is_test", {
    org_id: organizationId,
    requested_test: true,
  });

  try {
    const resultat = await outil.handler(appel.arguments, {
      organizationId,
      providerCallId: appel.providerCallId,
      // ADR-019 : un appel n'est un test que dans une organisation d'essai.
      isTest: Boolean(estTest),
    });

    await admin.from("activities").insert({
      organization_id: organizationId,
      actor_kind: "SOPHIE",
      type: "SOPHIE_TOOL_CALLED",
      subject_type: "call",
      summary: `${appel.name}${resultat.error ? " — refusé" : ""}`,
      metadata: { tool: appel.name, arguments: appel.arguments },
      correlation_id: null,
    });

    return NextResponse.json(
      provider.formatToolResponse([{ toolCallId: appel.toolCallId, ...resultat }]),
    );
  } catch (cause) {
    // Une exception non prévue ne doit pas couper l'appel en cours : on la
    // consigne et on laisse Sophie continuer avec une réponse honnête.
    console.error("[voice/tools] échec de l'outil", appel.name, cause);

    return NextResponse.json(
      provider.formatToolResponse([
        {
          toolCallId: appel.toolCallId,
          error:
            "Cette information n'est pas disponible pour le moment. Prenez la demande du " +
            "client et dites que le professionnel le rappellera.",
        },
      ]),
    );
  }
}

/**
 * Retrouve l'organisation concernée.
 *
 * L'identifiant est placé dans les métadonnées de l'assistant au moment où nous
 * le créons. Il ne vient donc jamais du modèle ni du client.
 */
async function resolveOrganization(
  rawBody: string,
  providerCallId: string,
): Promise<string | null> {
  try {
    const payload = JSON.parse(rawBody) as {
      message?: {
        assistant?: { metadata?: { organizationId?: string } };
        call?: { assistantId?: string; metadata?: { organizationId?: string } };
      };
    };

    const depuisMetadonnees =
      payload.message?.assistant?.metadata?.organizationId ??
      payload.message?.call?.metadata?.organizationId;

    if (depuisMetadonnees) {
      // On vérifie que l'organisation existe réellement avant de l'utiliser.
      const admin = createAdminClient();
      const { data } = await admin
        .from("organizations")
        .select("id")
        .eq("id", depuisMetadonnees)
        .is("deleted_at", null)
        .maybeSingle();

      return data ? (data.id as string) : null;
    }
  } catch {
    /* charge utile illisible : on tente la correspondance par appel */
  }

  if (!providerCallId) return null;

  // Repli : l'appel a déjà été enregistré chez nous par le webhook d'entrée.
  // Cette table arrive en Phase 4 ; d'ici là, le repli ne trouve rien.
  return null;
}
