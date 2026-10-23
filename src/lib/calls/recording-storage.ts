import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { clampRetentionDays, purgeDate } from "@/lib/org/recording";
import {
  BUCKET_ENREGISTREMENTS,
  TAILLE_MAXIMUM_OCTETS,
  cheminEnregistrement,
  typeAudioAccepte,
} from "./recording-path";

/**
 * Rapatriement de l'enregistrement chez nous.
 *
 * Pourquoi c'est fait tout de suite, dans le traitement du webhook, et pas dans
 * une tâche de nuit : les adresses fournies par le fournisseur **expirent**
 * (`presignedUrlsExpiresAt` dans le rapport réel du 23 octobre). Une tâche
 * nocturne trouverait des adresses mortes et échouerait silencieusement tous
 * les soirs.
 *
 * Le prix de ce choix est que le webhook dure plus longtemps. C'est acceptable :
 * il n'est pas dans le chemin de la conversation, contrairement aux outils.
 *
 * En cas d'échec, l'appel garde sa transcription, son résumé et son adresse
 * source. Rien d'autre n'est perdu (section 16).
 */
export async function rapatrierEnregistrement(params: {
  callId: string;
  organizationId: string;
  sourceUrl: string;
  /** Rétention en jours, telle que configurée par l'entreprise. */
  retentionDays: number;
}): Promise<{ ok: boolean; erreur?: string }> {
  const admin = createAdminClient();

  const echec = async (erreur: string) => {
    await admin
      .from("calls")
      .update({
        recording_status: "FAILED",
        recording_error: erreur.slice(0, 300),
        recording_source_url: params.sourceUrl,
      })
      .eq("id", params.callId);
    console.error("[audio] rapatriement échoué", params.callId, erreur);
    return { ok: false, erreur };
  };

  let reponse: Response;
  try {
    reponse = await fetch(params.sourceUrl, {
      // Au-delà, l'adresse signée est probablement morte ou le réseau est
      // coupé : mieux vaut un échec net qu'une fonction qui expire.
      signal: AbortSignal.timeout(20_000),
    });
  } catch (cause) {
    return echec(
      cause instanceof Error && cause.name === "TimeoutError"
        ? "Le fichier n'a pas répondu en 20 secondes."
        : "Le fichier n'a pas pu être téléchargé.",
    );
  }

  if (!reponse.ok) {
    return echec(
      reponse.status === 403 || reponse.status === 404
        ? "L'adresse du fichier a expiré chez le fournisseur."
        : `Le fournisseur a répondu ${reponse.status}.`,
    );
  }

  const contentType = reponse.headers.get("content-type");
  if (!typeAudioAccepte(contentType)) {
    return echec(`Type de fichier inattendu : ${contentType ?? "inconnu"}.`);
  }

  const buffer = Buffer.from(await reponse.arrayBuffer());
  if (buffer.byteLength === 0) return echec("Le fichier reçu est vide.");
  if (buffer.byteLength > TAILLE_MAXIMUM_OCTETS) {
    return echec(`Fichier trop volumineux : ${Math.round(buffer.byteLength / 1_048_576)} Mo.`);
  }

  let chemin: string;
  try {
    chemin = cheminEnregistrement(params.organizationId, params.callId, contentType);
  } catch (cause) {
    return echec(cause instanceof Error ? cause.message : "Chemin refusé.");
  }

  const { error: envoi } = await admin.storage
    .from(BUCKET_ENREGISTREMENTS)
    .upload(chemin, buffer, {
      contentType: contentType ?? "audio/mpeg",
      // Un webhook rejoué réécrit le même fichier au lieu d'en créer un second.
      upsert: true,
    });

  if (envoi) return echec(`Dépôt refusé : ${envoi.message}`);

  const { error: maj } = await admin
    .from("calls")
    .update({
      recording_path: chemin,
      recording_bytes: buffer.byteLength,
      recording_content_type: contentType,
      recording_expires_at: purgeDate(
        new Date(),
        clampRetentionDays(params.retentionDays),
      ).toISOString(),
      recording_status: "DONE",
      recording_error: null,
      recording_source_url: null,
    })
    .eq("id", params.callId);

  if (maj) {
    // Le fichier est déposé mais l'appel ne le sait pas : c'est le pire des
    // deux mondes, et il faut le dire plutôt que d'annoncer un succès.
    return echec(`Fichier déposé mais non rattaché à l'appel : ${maj.message}`);
  }

  return { ok: true };
}

/** Une adresse signée, valable quelques minutes, pour écouter l'appel. */
export async function adresseEcoute(
  chemin: string,
  secondes = 300,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET_ENREGISTREMENTS)
    .createSignedUrl(chemin, secondes);

  if (error) {
    console.error("[audio] adresse signée indisponible", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
