import { NextResponse, type NextRequest } from "next/server";
import { VapiVoiceProvider } from "@/lib/providers/voice/vapi";
import { accueilPourNumero } from "@/lib/sophie/runtime";
import {
  reponseAssistant,
  reponseRefus,
} from "@/lib/sophie/assistant-response";
import { reglages } from "@/lib/config/platform";
import { signalerErreurFournisseur } from "@/lib/platform/errors";

export const dynamic = "force-dynamic";
// Le fournisseur attend 7,5 secondes, délai non configurable, au-delà duquel
// l'appel échoue chez un vrai client. On se donne une marge franche en
// dessous : mieux vaut un refus poli qu'une sonnerie dans le vide.
export const maxDuration = 10;

/**
 * Qui décroche, et avec quelles phrases.
 *
 * Le fournisseur vocal envoie cette requête au moment où le téléphone sonne,
 * quand le numéro appelé ne désigne pas d'assistant fixe. Notre réponse
 * décide du nom prononcé, de la voix et de la première phrase. C'est ce qui
 * permet à chaque entreprise d'avoir son propre accueil sans qu'on déploie
 * quoi que ce soit : la phrase est lue en base à chaque appel.
 *
 * ## Les trois contraintes
 *
 * **Le temps.** 7,5 secondes de bout en bout. Une lecture en base, une
 * réponse, rien d'autre.
 *
 * **La certitude.** Si le numéro appelé n'est rattaché à personne, on ne
 * cherche pas une organisation « probable ». On rend une erreur parlée. Faire
 * décrocher Sophie au nom d'une entreprise qu'on a devinée serait pire que de
 * ne pas décrocher.
 *
 * **La transparence.** La mention d'IA est garantie par `composerAccueil`,
 * pas par le texte que le client a saisi. L'annonce d'enregistrement est
 * ajoutée séparément, et seulement quand l'enregistrement a réellement lieu.
 */
export async function POST(request: NextRequest) {
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
    authentique = false;
  }

  if (!authentique) {
    return new NextResponse("signature invalide", { status: 401 });
  }

  const payload = lire(rawBody);
  if (payload.message?.type !== "assistant-request") {
    // Ce chemin ne traite que la demande d'assistant. Les autres événements
    // ont leur route ; répondre ici produirait deux traitements du même fait.
    return NextResponse.json({});
  }

  const numeroAppele =
    payload.message?.phoneNumber?.number ??
    payload.message?.call?.phoneNumber?.number;

  if (!numeroAppele) {
    return NextResponse.json(reponseRefus("NUMERO_INCONNU"));
  }

  try {
    const resolution = await accueilPourNumero(numeroAppele);

    if (!resolution.ok) {
      return NextResponse.json(reponseRefus(resolution.refus));
    }

    const { accueil } = resolution;

    const config = await reglages("voice", {
      assistant_id: process.env.VOICE_ASSISTANT_ID?.trim() ?? "",
    });

    const assistantId =
      accueil.assistantExternalId?.trim() ||
      String(config.assistant_id ?? "").trim();

    if (!assistantId) {
      // Aucun assistant déclaré : rien à personnaliser, et un assistant
      // inventé ici serait refusé par le fournisseur.
      return NextResponse.json(reponseRefus("SANS_ASSISTANT"));
    }

    return NextResponse.json(reponseAssistant(assistantId, accueil));
  } catch (cause) {
    await signalerErreurFournisseur({
      provider: "VOICE",
      operation: "assistant-request",
      message: cause instanceof Error ? cause.message : "résolution échouée",
      correlationId: numeroAppele,
    });

    // Le client est au bout du fil. On préfère une phrase honnête à un silence.
    return NextResponse.json(reponseRefus("PANNE"));
  }
}

interface AssistantRequestPayload {
  message?: {
    type?: string;
    phoneNumber?: { number?: string };
    call?: { phoneNumber?: { number?: string } };
  };
}

function lire(rawBody: string): AssistantRequestPayload {
  try {
    return JSON.parse(rawBody) as AssistantRequestPayload;
  } catch {
    return {};
  }
}
