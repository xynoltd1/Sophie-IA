import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VapiVoiceProvider } from "@/lib/providers/voice/vapi";
import { findTool } from "@/lib/sophie/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

/**
 * Un identifiant venu de l'URL est filtré avant d'atteindre la base.
 * Pas par peur d'une injection — le client Supabase paramètre ses requêtes —
 * mais pour qu'une valeur fantaisiste soit rejetée tout de suite, sans aller
 * interroger la base à chaque appel d'outil.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const organizationId = await resolveOrganization(
    rawBody,
    appel.providerCallId,
    request.nextUrl,
  );

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

  // L'appel tel que NOUS l'avons enregistré. Le numéro de l'appelant vient du
  // réseau téléphonique, jamais de ce que le modèle a cru entendre : c'est la
  // seule donnée de la conversation qu'on ne peut pas mal comprendre.
  const { data: appelEnregistre } = await admin
    .from("calls")
    .select("id, from_e164")
    .eq("provider_call_id", appel.providerCallId)
    .maybeSingle();

  try {
    const resultat = await outil.handler(appel.arguments, {
      organizationId,
      providerCallId: appel.providerCallId,
      // ADR-019 : un appel n'est un test que dans une organisation d'essai.
      isTest: Boolean(estTest),
      callerNumber: (appelEnregistre?.from_e164 as string | null) ?? callerNumber(rawBody),
      callId: (appelEnregistre?.id as string | null) ?? null,
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
 * Trois sources, dans cet ordre de confiance décroissante. Aucune ne vient du
 * modèle : Sophie ne décide jamais chez qui elle travaille.
 *
 * **1. Le numéro appelé.** C'est la source de référence. La table
 * `phone_numbers` fait le lien, et elle est écrite par nous. Un appel arrivé
 * sur le numéro d'un plombier ne peut pas toucher les données d'un autre, quoi
 * qu'annonce le reste de la charge utile.
 *
 * **2. L'appel déjà enregistré chez nous**, retrouvé par son identifiant
 * fournisseur. Utile quand la charge utile d'un outil ne répète pas le numéro
 * appelé — c'est fréquent en milieu de conversation.
 *
 * **3. Les métadonnées de l'assistant**, que nous avons écrites nous-mêmes.
 * Gardées en dernier recours parce qu'elles dépendent d'une configuration
 * manuelle dans l'interface du fournisseur, donc d'un oubli possible.
 *
 * Limite assumée du troisième cas : le secret de webhook est global. Quelqu'un
 * qui le connaîtrait pourrait se présenter au nom de n'importe quelle
 * organisation. Les deux premières sources n'ont pas ce défaut, puisqu'elles
 * vérifient contre nos propres tables. C'est pourquoi elles passent devant.
 */
async function resolveOrganization(
  rawBody: string,
  providerCallId: string,
  requestUrl: URL,
): Promise<string | null> {
  let payload: VapiContext = {};
  try {
    payload = JSON.parse(rawBody) as VapiContext;
  } catch {
    /* charge utile illisible : il reste la correspondance par appel */
  }

  const admin = createAdminClient();

  // 1. Le numéro appelé.
  const numeroAppele = calledNumber(payload);
  if (numeroAppele) {
    const { data } = await admin.rpc("organization_for_number", {
      numero: numeroAppele,
    });
    const ligne = Array.isArray(data) ? data[0] : data;
    if (ligne?.organization_id) return ligne.organization_id as string;
  }

  // 2. L'appel déjà ouvert chez nous.
  if (providerCallId) {
    const { data } = await admin
      .from("calls")
      .select("organization_id")
      .eq("provider_call_id", providerCallId)
      .maybeSingle();

    if (data?.organization_id) return data.organization_id as string;
  }

  // 3. L'organisation inscrite dans l'adresse de notre propre endpoint.
  //
  // C'est NOUS qui configurons cette URL chez le fournisseur, au même titre que
  // les métadonnées de l'assistant : le modèle ne peut pas la changer. Elle a
  // l'avantage d'être un simple champ texte, modifiable partout, alors que les
  // métadonnées se cachent dans une interface qui bouge d'une version à l'autre.
  //
  // Elle sert surtout aux essais depuis le navigateur, qui n'ont aucun numéro
  // appelé. En production, c'est la source 1 qui répond.
  const depuisUrl = requestUrl.searchParams.get("org");
  if (depuisUrl && UUID.test(depuisUrl)) {
    const { data } = await admin
      .from("organizations")
      .select("id")
      .eq("id", depuisUrl)
      .is("deleted_at", null)
      .maybeSingle();

    if (data) return data.id as string;
  }

  // 4. Les métadonnées.
  const depuisMetadonnees =
    payload.message?.assistant?.metadata?.organizationId ??
    payload.message?.call?.metadata?.organizationId ??
    payload.message?.call?.assistantOverrides?.metadata?.organizationId;

  if (depuisMetadonnees) {
    const { data } = await admin
      .from("organizations")
      .select("id")
      .eq("id", depuisMetadonnees)
      .is("deleted_at", null)
      .maybeSingle();

    return data ? (data.id as string) : null;
  }

  return null;
}

interface VapiContext {
  message?: {
    assistant?: { metadata?: { organizationId?: string } };
    phoneNumber?: { number?: string };
    call?: {
      assistantId?: string;
      metadata?: { organizationId?: string };
      assistantOverrides?: { metadata?: { organizationId?: string } };
      phoneNumber?: { number?: string };
      phoneCallProviderDetails?: { to?: string };
      customer?: { number?: string };
      to?: string;
    };
  };
}

/**
 * Le numéro APPELÉ, et surtout pas celui de l'appelant.
 *
 * Les fournisseurs ne s'accordent pas sur l'endroit où ils le placent, et la
 * forme change d'une version d'API à l'autre. On essaie les emplacements
 * connus plutôt que d'en supposer un seul : se tromper ici ne produit pas une
 * erreur visible, mais un appel rattaché à la mauvaise entreprise.
 *
 * `customer.number` est délibérément EXCLU : c'est le numéro de l'appelant.
 * L'utiliser rattacherait l'appel à l'organisation du client s'il se trouvait
 * être lui-même utilisateur du produit.
 */
function calledNumber(payload: VapiContext): string | null {
  const candidats = [
    payload.message?.phoneNumber?.number,
    payload.message?.call?.phoneNumber?.number,
    payload.message?.call?.phoneCallProviderDetails?.to,
    payload.message?.call?.to,
  ];

  for (const candidat of candidats) {
    if (typeof candidat === "string" && candidat.trim().length > 0) {
      return candidat.trim();
    }
  }
  return null;
}

/**
 * Numéro de l'appelant lu dans la charge utile.
 *
 * Repli utilisé tant que l'appel n'a pas été enregistré chez nous — un outil
 * peut arriver avant l'événement de début d'appel, les webhooks n'étant pas
 * ordonnés. Moins fiable que notre propre table, d'où sa place en second.
 */
function callerNumber(rawBody: string): string | null {
  try {
    const payload = JSON.parse(rawBody) as {
      message?: {
        customer?: { number?: string };
        call?: { customer?: { number?: string } };
      };
    };

    const brut =
      payload.message?.customer?.number ?? payload.message?.call?.customer?.number;

    return typeof brut === "string" && brut.trim().length > 0 ? brut.trim() : null;
  } catch {
    return null;
  }
}
