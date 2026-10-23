import { NextResponse, type NextRequest } from "next/server";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { adresseEcoute } from "@/lib/calls/recording-storage";

export const dynamic = "force-dynamic";

/**
 * Écouter l'enregistrement d'un appel.
 *
 * Le navigateur demande un APPEL par son identifiant. Il ne nomme jamais un
 * fichier, et il ne reçoit jamais d'adresse permanente (section 40).
 *
 * Trois vérifications, dans cet ordre, et aucune n'est redondante :
 *
 * 1. une session valide — sinon rien ;
 * 2. l'appel doit appartenir à l'organisation active. Cette lecture passe par
 *    le client de session, donc par RLS : même si ce code se trompait, la base
 *    ne renverrait pas l'appel d'une autre entreprise ;
 * 3. l'adresse signée est produite côté serveur, pour quelques minutes.
 *
 * On redirige vers l'adresse signée plutôt que de faire transiter le fichier :
 * un MP3 de plusieurs mégaoctets n'a aucune raison de traverser une fonction
 * serverless, et la balise `<audio>` suit la redirection sans rien savoir.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let organizationId: string;
  try {
    const { activeOrganization } = await requireOrganization();
    organizationId = activeOrganization.organization_id;
  } catch {
    return new NextResponse("non autorisé", { status: 401 });
  }

  const supabase = await createServerSupabase();
  const { data: appel } = await supabase
    .from("calls")
    .select("id, recording_path")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!appel) return new NextResponse("introuvable", { status: 404 });

  const chemin = appel.recording_path as string | null;
  if (!chemin) return new NextResponse("aucun enregistrement", { status: 404 });

  const adresse = await adresseEcoute(chemin);
  if (!adresse) return new NextResponse("enregistrement indisponible", { status: 503 });

  // 302 et non 301 : l'adresse signée change à chaque demande, elle ne doit
  // jamais être mise en cache par le navigateur ni par un intermédiaire.
  return NextResponse.redirect(adresse, {
    status: 302,
    headers: { "cache-control": "private, no-store" },
  });
}
