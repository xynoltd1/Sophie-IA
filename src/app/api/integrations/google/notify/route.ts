import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncCalendar } from "@/lib/providers/calendar/service";

export const dynamic = "force-dynamic";

/**
 * Notification de changement envoyée par Google.
 *
 * Google ne signe pas ces appels. L'authentification repose sur le jeton de
 * canal fourni à l'abonnement et renvoyé dans l'en-tête `X-Goog-Channel-Token`.
 * Un appel sans jeton valide est rejeté sans rien révéler.
 *
 * Le corps de la requête est vide : Google dit seulement « quelque chose a
 * changé ». C'est à nous d'aller relire, ce que fait syncCalendar().
 */
export async function POST(request: NextRequest) {
  const channelToken = request.headers.get("x-goog-channel-token");
  const resourceState = request.headers.get("x-goog-resource-state");

  if (!channelToken) {
    return new NextResponse("jeton manquant", { status: 401 });
  }

  // `sync` est le message de confirmation envoyé à la création de
  // l'abonnement. Rien à faire, mais il faut répondre 200 sans quoi Google
  // considère l'abonnement défaillant.
  if (resourceState === "sync") {
    return new NextResponse(null, { status: 204 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("calendar_connections")
    .select("organization_id")
    .eq("channel_id", channelToken)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) {
    // Abonnement inconnu : probablement une connexion supprimée entre-temps.
    return new NextResponse("canal inconnu", { status: 404 });
  }

  const resultat = await syncCalendar(data.organization_id as string);

  // On répond 200 même en cas d'échec de synchronisation : un code d'erreur
  // pousserait Google à désactiver l'abonnement après quelques tentatives.
  // L'échec est déjà consigné dans last_error et sera repris par le job.
  return NextResponse.json({ received: true, synced: resultat.ok });
}
