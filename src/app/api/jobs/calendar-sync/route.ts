import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncCalendar } from "@/lib/providers/calendar/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Synchronisation périodique des agendas.
 *
 * Les notifications de Google sont le chemin normal, mais elles expirent et
 * peuvent se perdre. Ce travail planifié est le filet : il rattrape les
 * connexions dont la dernière synchronisation est trop ancienne.
 *
 * Déclenché par Vercel Cron. Protégé par un secret partagé, sinon n'importe qui
 * pourrait le déclencher en boucle et épuiser le quota Google.
 */
function autorise(request: NextRequest): boolean {
  // Vercel Cron envoie `Authorization: Bearer <CRON_SECRET>` quand la variable
  // CRON_SECRET existe. On accepte aussi JOB_RUNNER_SECRET pour un
  // déclenchement manuel ou depuis un autre ordonnanceur.
  const acceptes = [process.env.CRON_SECRET?.trim(), process.env.JOB_RUNNER_SECRET?.trim()]
    .filter((valeur): valeur is string => Boolean(valeur));

  if (acceptes.length === 0) return false;

  const fourni =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-job-secret") ??
    "";

  if (!fourni) return false;

  const a = Buffer.from(fourni);
  return acceptes.some((attendu) => {
    const b = Buffer.from(attendu);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export async function GET(request: NextRequest) {
  if (!autorise(request)) {
    return new NextResponse("non autorisé", { status: 401 });
  }

  const admin = createAdminClient();
  const seuil = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: connexions } = await admin
    .from("calendar_connections")
    .select("organization_id, consecutive_failures")
    .eq("is_active", true)
    .or(`last_synced_at.is.null,last_synced_at.lt.${seuil}`)
    // Une connexion qui échoue systématiquement ne doit pas monopoliser le job.
    .lt("consecutive_failures", 10)
    .limit(50);

  const resultats = [];
  for (const connexion of connexions ?? []) {
    const resultat = await syncCalendar(connexion.organization_id as string);
    resultats.push({ organization: connexion.organization_id, ok: resultat.ok });
  }

  return NextResponse.json({
    processed: resultats.length,
    failed: resultats.filter((r) => !r.ok).length,
  });
}
