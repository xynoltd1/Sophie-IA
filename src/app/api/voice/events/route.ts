import { NextResponse, type NextRequest } from "next/server";
import { VapiVoiceProvider } from "@/lib/providers/voice/vapi";
import { closeCall, openCall, openTestCall, schedulePostCall } from "@/lib/calls/registry";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Événements d'appel envoyés par le fournisseur de voix.
 *
 * Distinct de `/api/voice/tools` à dessein. Les outils répondent PENDANT la
 * conversation et sont dans le chemin critique : un retard s'entend au
 * téléphone. Les événements, eux, racontent le cycle de vie de l'appel et
 * peuvent prendre leur temps.
 *
 * Trois règles, héritées des erreurs déjà commises sur ce projet.
 *
 * **Toujours répondre 200.** Un code d'erreur fait réessayer le fournisseur, et
 * ses réessais arrivent dans le désordre. Un événement qu'on ne sait pas
 * traiter est un événement qu'on ignore, pas une panne qu'on signale.
 *
 * **Être idempotent.** Les webhooks sont rejoués. Deux livraisons du même
 * événement doivent produire le même résultat qu'une seule.
 *
 * **Ne jamais perdre l'appel.** L'appel est créé dès qu'il sonne. Si la suite
 * échoue — transcription, résumé, audio — il reste la trace d'un appel reçu,
 * ce qui est déjà l'essentiel pour l'artisan.
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

  // Ici, et seulement ici, on refuse avec un code d'erreur : une requête non
  // authentifiée n'est pas un événement mal formé, c'est quelqu'un d'autre.
  if (!authentique) {
    return new NextResponse("signature invalide", { status: 401 });
  }

  const evenement = provider.parseEvent(rawBody);
  if (!evenement?.providerCallId) {
    return NextResponse.json({ ignored: true });
  }

  try {
    switch (evenement.type) {
      case "CALL_STARTED":
        await demarrer(
          rawBody,
          evenement.providerCallId,
          evenement.occurredAt,
          request.nextUrl,
        );
        break;

      case "CALL_ENDED":
        await terminer(rawBody, evenement.providerCallId, evenement.occurredAt);
        break;

      default:
        // Transcriptions partielles et mises à jour de parole : utiles plus
        // tard pour l'affichage en direct, sans intérêt aujourd'hui.
        break;
    }
  } catch (cause) {
    // On consigne et on acquitte quand même. Faire réessayer le fournisseur
    // sur une erreur de notre côté ne répare rien et multiplie les livraisons.
    console.error("[voice/events] traitement échoué", evenement.type, cause);
  }

  return NextResponse.json({ received: true });
}

interface EventPayload {
  message?: {
    call?: { id?: string; phoneNumber?: { number?: string }; customer?: { number?: string } };
    phoneNumber?: { number?: string };
    customer?: { number?: string };
    durationSeconds?: number;
    endedReason?: string;
    recordingUrl?: string;
    artifact?: { recordingUrl?: string };
  };
}

function lire(rawBody: string): EventPayload {
  try {
    return JSON.parse(rawBody) as EventPayload;
  } catch {
    return {};
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function demarrer(
  rawBody: string,
  providerCallId: string,
  occurredAt: Date,
  requestUrl: URL,
) {
  const payload = lire(rawBody);

  const numeroAppele =
    payload.message?.phoneNumber?.number ?? payload.message?.call?.phoneNumber?.number;

  const appelant = payload.message?.customer?.number ?? payload.message?.call?.customer?.number;

  if (numeroAppele) {
    // Chemin normal : le numéro appelé désigne l'organisation, et la table
    // `phone_numbers` dit si cette ligne est une ligne d'essai.
    await openCall({
      provider: "VAPI",
      providerCallId,
      toNumber: numeroAppele,
      fromNumber: appelant ?? null,
      startedAt: occurredAt,
    });
    return;
  }

  // Essai depuis le navigateur : aucun numéro appelé. L'organisation vient de
  // l'adresse que nous avons configurée, et l'appel est forcément un essai —
  // personne ne peut composer un numéro qui n'existe pas.
  const org = requestUrl.searchParams.get("org");
  if (!org || !UUID.test(org)) return;

  await openTestCall({
    organizationId: org,
    provider: "VAPI",
    providerCallId,
    fromNumber: appelant ?? null,
    startedAt: occurredAt,
  });
}

async function terminer(rawBody: string, providerCallId: string, occurredAt: Date) {
  const payload = lire(rawBody);
  const admin = createAdminClient();

  const { data: appel } = await admin
    .from("calls")
    .select("id")
    .eq("provider", "VAPI")
    .eq("provider_call_id", providerCallId)
    .maybeSingle();

  if (!appel) return;

  const raison = payload.message?.endedReason ?? null;

  // La durée est arrondie par `closeCall`. Elle est transmise telle quelle ici
  // pour que l'arrondi reste à un seul endroit.
  await closeCall(appel.id as string, {
    // La distinction est celle que l'artisan lira sur sa fiche : un appel
    // qu'il a manqué et un appel qui a échoué techniquement n'appellent pas
    // la même réaction.
    status: raisonEstEchec(raison) ? "FAILED" : "COMPLETED",
    endedAt: occurredAt,
    durationSeconds: payload.message?.durationSeconds ?? null,
    endedReason: raison,
  });

  const audio = payload.message?.recordingUrl ?? payload.message?.artifact?.recordingUrl;

  // L'audio est signalé « à traiter » : la copie vers notre propre espace
  // européen viendra dans un second temps, et doit pouvoir être réessayée
  // sans toucher au reste.
  await schedulePostCall(appel.id as string, {
    recording: audio ? "PENDING" : "NOT_APPLICABLE",
  });
}

/** Les fins d'appel qui traduisent une panne, et non un raccrochage normal. */
function raisonEstEchec(raison: string | null): boolean {
  if (!raison) return false;
  const normalise = raison.toLowerCase();
  return (
    normalise.includes("error") ||
    normalise.includes("failed") ||
    normalise.includes("pipeline")
  );
}
