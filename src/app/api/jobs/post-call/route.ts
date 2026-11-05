import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jobAutorise } from "@/lib/jobs/auth";
import {
  PLAFOND_TENTATIVES,
  genererIntelligenceAppel,
} from "@/lib/calls/intelligence";
import { viderLaFile } from "@/lib/messaging/outbox";
import { executerPurges } from "@/lib/jobs/retention";

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
    smsEnvoyes: 0,
    smsEchoues: 0,
    holdsLiberes: 0,
  };
  const purges: Record<string, number> = {};
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
    erreurs.push(
      `résumés : ${cause instanceof Error ? cause.message : "échec"}`,
    );
  }

  // 2. Toutes les purges de conservation, journalisées une par une.
  //
  //    Déplacées dans `src/lib/jobs/retention.ts` : elles sont devenues six
  //    traitements avec leur journal, et un fichier de travail planifié qui
  //    fait six choses différentes finit par n'en faire aucune correctement.
  try {
    for (const rapport of await executerPurges()) {
      purges[rapport.genre] = rapport.traites;
      if (rapport.erreur)
        erreurs.push(`purge ${rapport.genre} : ${rapport.erreur}`);
    }
  } catch (cause) {
    erreurs.push(
      `purges : ${cause instanceof Error ? cause.message : "échec"}`,
    );
  }

  // 3. Les messages restés en file (section 26).
  try {
    const { envoyes, echoues } = await viderLaFile(25);
    compte.smsEnvoyes = envoyes;
    compte.smsEchoues = echoues;
  } catch (cause) {
    erreurs.push(
      `messages : ${cause instanceof Error ? cause.message : "échec"}`,
    );
  }

  // 4. Les créneaux bloqués par un appel interrompu (section 20).
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

  return NextResponse.json({ ...compte, purges, erreurs });
}
