import { NextResponse, type NextRequest } from "next/server";
import { VapiVoiceProvider } from "@/lib/providers/voice/vapi";
import { closeCall, openCall, openTestCall, schedulePostCall } from "@/lib/calls/registry";
import { etatsDepuisRapport, lireRapport } from "@/lib/calls/report";
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
    .select("id, organization_id, is_test")
    .eq("provider", "VAPI")
    .eq("provider_call_id", providerCallId)
    .maybeSingle();

  if (!appel) return;

  const callId = appel.id as string;
  const organizationId = appel.organization_id as string;

  const raison = payload.message?.endedReason ?? null;

  // La durée est arrondie par `closeCall`. Elle est transmise telle quelle ici
  // pour que l'arrondi reste à un seul endroit.
  await closeCall(callId, {
    // La distinction est celle que l'artisan lira sur sa fiche : un appel
    // qu'il a manqué et un appel qui a échoué techniquement n'appellent pas
    // la même réaction.
    status: raisonEstEchec(raison) ? "FAILED" : "COMPLETED",
    endedAt: occurredAt,
    durationSeconds: payload.message?.durationSeconds ?? null,
    endedReason: raison,
  });

  await exploiterRapport(callId, organizationId, Boolean(appel.is_test), payload);
}

/**
 * Tire du rapport de fin d'appel tout ce qu'il contient : la trace brute, la
 * transcription, le résumé, les données extraites.
 *
 * L'ordre n'est pas indifférent. La trace brute est écrite EN PREMIER, avant
 * toute interprétation. Si notre lecture se trompe — un champ renommé par le
 * fournisseur, une forme inattendue — le rapport reste en base et l'extraction
 * peut être rejouée après correction. Sans lui, une erreur de lecture perdrait
 * définitivement la conversation (section 16).
 *
 * Chaque étape est isolée : un résumé manquant n'empêche pas la transcription
 * d'être écrite, et une transcription manquante n'empêche pas l'audio.
 */
async function exploiterRapport(
  callId: string,
  organizationId: string,
  estEssai: boolean,
  payload: unknown,
) {
  const admin = createAdminClient();

  // 1. La source, avant toute interprétation.
  const { error: traceEchouee } = await admin.from("call_events").upsert(
    {
      organization_id: organizationId,
      call_id: callId,
      provider: "VAPI",
      type: "end-of-call-report",
      payload: payload as Record<string, unknown>,
    },
    { onConflict: "call_id,type" },
  );
  if (traceEchouee) {
    console.error("[voice/events] rapport brut non conservé", traceEchouee.message);
  }

  const rapport = lireRapport(payload);

  // 2. L'enregistrement n'est autorisé que si l'organisation l'a activé et a
  //    accepté la politique applicable (section 42). La question est tranchée
  //    en base, jamais ici.
  let enregistrementAutorise = false;
  const { data: autorise, error: refus } = await admin.rpc("recording_allowed", {
    org_id: organizationId,
    is_test: estEssai,
  });
  if (refus) console.error("[voice/events] recording_allowed indisponible", refus.message);
  else enregistrementAutorise = autorise === true;

  // 3. La transcription. Réécrite entièrement : un rapport rejoué doit donner
  //    la même conversation, pas une conversation doublée.
  if (rapport.segments.length > 0) {
    await admin.from("call_transcript_segments").delete().eq("call_id", callId);

    const { error } = await admin.from("call_transcript_segments").insert(
      rapport.segments.map((segment) => ({
        organization_id: organizationId,
        call_id: callId,
        ordinal: segment.ordinal,
        speaker: segment.speaker,
        content: segment.content,
        started_ms: segment.startedMs,
        ended_ms: segment.endedMs,
      })),
    );
    if (error) console.error("[voice/events] transcription non écrite", error.message);
  }

  // 4. Le résumé et les données extraites.
  if (rapport.resume || rapport.donnees) {
    const { error } = await admin
      .from("calls")
      .update({ summary: rapport.resume, structured_data: rapport.donnees })
      .eq("id", callId);
    if (error) console.error("[voice/events] résumé non écrit", error.message);
  }

  // 5. Les trois états, chacun indépendant.
  const etats = etatsDepuisRapport(rapport, { enregistrementAutorise });
  await schedulePostCall(callId, {
    transcription: etats.transcription,
    summary: etats.resume,
    recording: etats.enregistrement,
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
