import { NextResponse, type NextRequest } from "next/server";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { genererIntelligenceAppel } from "@/lib/calls/intelligence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Relancer le résumé d'un appel à la main (section 16).
 *
 * « Résumé indisponible — Réessayer » n'a de sens que si le bouton fait
 * quelque chose. L'appartenance de l'appel est vérifiée par une lecture passant
 * par RLS : même si ce code se trompait, la base refuserait l'appel d'une autre
 * entreprise.
 *
 * `force` est implicite : quand un humain clique sur « Réessayer », il demande
 * une nouvelle tentative, y compris si le plafond automatique est atteint.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let organizationId: string;
  try {
    const { activeOrganization } = await requireOrganization();
    organizationId = activeOrganization.organization_id;
  } catch {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }

  const supabase = await createServerSupabase();
  const { data: appel } = await supabase
    .from("calls")
    .select("id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!appel)
    return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const resultat = await genererIntelligenceAppel(id, { force: true });

  return NextResponse.json({
    ok: resultat.ok,
    simule: resultat.simule,
    erreur: resultat.erreur ?? null,
  });
}
