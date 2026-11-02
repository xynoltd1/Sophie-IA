import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jobAutorise } from "@/lib/jobs/auth";
import { syncCalendar } from "@/lib/providers/calendar/service";
import { signalerErreurFournisseur } from "@/lib/platform/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Synchronisation périodique des agendas.
 *
 * Les notifications de Google sont le chemin normal, mais elles expirent et
 * peuvent se perdre. Ce travail planifié est le filet : il rattrape les
 * connexions dont la dernière synchronisation est trop ancienne.
 *
 * Il ne tourne qu'une fois par jour : un compte Vercel Hobby n'autorise pas
 * mieux, et un déploiement portant une fréquence supérieure est refusé avant
 * même la compilation (ADR-024). La fraîcheur réelle vient donc de
 * `ensureCalendarFresh`, appelée au moment où une réponse en dépend. Ce travail
 * ne sert plus qu'aux connexions que personne n'a consultées depuis longtemps.
 *
 * Déclenché par Vercel Cron. Protégé par un secret partagé, sinon n'importe qui
 * pourrait le déclencher en boucle et épuiser le quota Google.
 */
export async function GET(request: NextRequest) {
  if (!jobAutorise(request.headers)) {
    return new NextResponse("non autorisé", { status: 401 });
  }

  const admin = createAdminClient();
  // Une heure, pas trente minutes : ce qui est juste « un peu » périmé sera
  // rafraîchi à la demande de toute façon. Ici on vise ce que personne ne
  // consulte.
  const seuil = new Date(Date.now() - 60 * 60 * 1000).toISOString();

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
    resultats.push({
      organization: connexion.organization_id,
      ok: resultat.ok,
    });

    // Un agenda qui ne se synchronise plus se voit d'abord ici : l'artisan,
    // lui, ne constate rien tant qu'il ne propose pas de créneau.
    if (!resultat.ok) {
      await signalerErreurFournisseur({
        provider: "GOOGLE_CALENDAR",
        operation: "syncCalendar",
        message: resultat.error ?? "synchronisation échouée",
        organizationId: connexion.organization_id as string,
      });
    }
  }

  return NextResponse.json({
    processed: resultats.length,
    failed: resultats.filter((r) => !r.ok).length,
  });
}
