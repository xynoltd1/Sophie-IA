import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jobAutorise } from "@/lib/jobs/auth";
import { PLAFOND_TENTATIVES, genererIntelligenceAppel } from "@/lib/calls/intelligence";
import { BUCKET_ENREGISTREMENTS } from "@/lib/calls/recording-path";
import { viderLaFile } from "@/lib/messaging/outbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Entretien après appel : reprises et purges.
 *
 * Trois travaux indépendants, dans un seul passage parce qu'un compte Hobby
 * n'autorise que deux tâches planifiées (ADR-024). Chacun est protégé : si
 * l'un échoue, les autres s'exécutent quand même, et le compte rendu dit
 * lequel a échoué.
 *
 * Le chemin normal du résumé est le webhook de fin d'appel. Ce travail est le
 * filet : il rattrape ce qui a dépassé le temps imparti, ce que le fournisseur
 * a refusé pendant une surcharge, et ce qui est arrivé pendant une panne.
 */
export async function GET(request: NextRequest) {
  if (!jobAutorise(request.headers)) {
    return new NextResponse("non autorisé", { status: 401 });
  }

  const admin = createAdminClient();
  const compte = {
    resumes: 0,
    resumesEchoues: 0,
    audiosPurges: 0,
    rapportsPurges: 0,
    smsEnvoyes: 0,
    smsEchoues: 0,
    holdsLiberes: 0,
  };
  const erreurs: string[] = [];

  // 1. Les résumés manquants.
  try {
    const { data } = await admin.rpc("calls_awaiting_summary", {
      plafond_tentatives: PLAFOND_TENTATIVES,
      // Dix par passage : le temps imparti est de soixante secondes, et
      // dépasser ferait perdre le travail déjà fait.
      limite: 10,
    });

    for (const ligne of (data ?? []) as { call_id: string }[]) {
      const resultat = await genererIntelligenceAppel(ligne.call_id);
      if (resultat.ok) compte.resumes += 1;
      else compte.resumesEchoues += 1;
    }
  } catch (cause) {
    erreurs.push(`résumés : ${cause instanceof Error ? cause.message : "échec"}`);
  }

  // 2. Les enregistrements arrivés à échéance (section 42).
  //
  //    Le fichier est supprimé du stockage AVANT que l'appel oublie son
  //    chemin : dans l'ordre inverse, un échec laisserait un fichier que plus
  //    rien ne référence, donc que plus rien ne supprimera jamais.
  try {
    const { data } = await admin.rpc("expired_recordings", { limite: 100 });
    const lignes = (data ?? []) as { call_id: string; recording_path: string }[];

    if (lignes.length > 0) {
      const { error } = await admin.storage
        .from(BUCKET_ENREGISTREMENTS)
        .remove(lignes.map((l) => l.recording_path));

      if (error) {
        erreurs.push(`purge audio : ${error.message}`);
      } else {
        await admin
          .from("calls")
          .update({
            recording_path: null,
            recording_bytes: null,
            recording_expires_at: null,
            recording_status: "NOT_APPLICABLE",
          })
          .in(
            "id",
            lignes.map((l) => l.call_id),
          );
        compte.audiosPurges = lignes.length;
      }
    }
  } catch (cause) {
    erreurs.push(`purge audio : ${cause instanceof Error ? cause.message : "échec"}`);
  }

  // 3. Les rapports bruts arrivés à échéance : ils contiennent la
  //    transcription, donc des données personnelles.
  try {
    const { data } = await admin.rpc("purge_expired_call_events");
    compte.rapportsPurges = typeof data === "number" ? data : 0;
  } catch (cause) {
    erreurs.push(`purge rapports : ${cause instanceof Error ? cause.message : "échec"}`);
  }

  // 4. Les messages restés en file (section 26).
  try {
    const { envoyes, echoues } = await viderLaFile(25);
    compte.smsEnvoyes = envoyes;
    compte.smsEchoues = echoues;
  } catch (cause) {
    erreurs.push(`messages : ${cause instanceof Error ? cause.message : "échec"}`);
  }

  // 5. Les créneaux bloqués par un appel interrompu (section 20).
  //
  //    Sans cette libération, un appel coupé au milieu d'une réservation
  //    retiendrait un créneau pour toujours, et l'artisan perdrait des
  //    rendez-vous sans jamais comprendre pourquoi.
  try {
    const { data } = await admin.rpc("release_expired_holds", { org_id: null });
    compte.holdsLiberes = typeof data === "number" ? data : 0;
  } catch (cause) {
    erreurs.push(`holds : ${cause instanceof Error ? cause.message : "échec"}`);
  }

  return NextResponse.json({ ...compte, erreurs });
}
