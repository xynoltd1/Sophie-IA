import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { verifyPayload } from "@/lib/crypto/secrets";
import { echangerCode } from "@/lib/seo/search-console";
import { journaliserAdmin } from "@/lib/platform/audit";

export const dynamic = "force-dynamic";

const ETAT_DUREE_MS = 10 * 60 * 1000;

function retour(origine: string, statut: string) {
  return NextResponse.redirect(new URL(`/admin/seo?console=${statut}`, origine));
}

export async function GET(request: NextRequest) {
  const origine = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;

  // Refus sur l'écran Google : ce n'est pas une panne.
  if (params.get("error")) return retour(origine, "refuse");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return retour(origine, "reponse_incomplete");

  const charge = verifyPayload(state);
  if (!charge) return retour(origine, "etat_invalide");

  let donnees: { user?: string; at?: number };
  try {
    donnees = JSON.parse(charge) as typeof donnees;
  } catch {
    return retour(origine, "etat_invalide");
  }

  if (!donnees.user || !donnees.at) return retour(origine, "etat_invalide");
  if (Date.now() - donnees.at > ETAT_DUREE_MS) return retour(origine, "etat_expire");

  // La signature prouve que l'état vient de nous, pas que la personne qui
  // revient est celle qui est partie. On revérifie la session.
  const { userId } = await requirePlatformAdmin();
  if (userId !== donnees.user) return retour(origine, "session_differente");

  const resultat = await echangerCode(code, origine, userId);
  if (!resultat.ok) return retour(origine, "echec");

  await journaliserAdmin({
    actorUserId: userId,
    action: "search_console.connect",
    resourceType: "search_console_connection",
    outcome: "SUCCESS",
  });

  return retour(origine, "connecte");
}
