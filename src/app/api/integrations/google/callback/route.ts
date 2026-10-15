import { NextResponse, type NextRequest } from "next/server";
import { requireOrganization } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { verifyPayload } from "@/lib/crypto/secrets";
import { connectCalendar } from "@/lib/providers/calendar/service";

export const dynamic = "force-dynamic";

/** Une autorisation ne doit pas pouvoir être rejouée des heures plus tard. */
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function retour(origin: string, statut: string) {
  return NextResponse.redirect(new URL(`/app/plus?agenda=${statut}`, origin));
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;

  // L'utilisateur a refusé sur l'écran Google : ce n'est pas une erreur.
  if (params.get("error")) {
    return retour(origin, "refuse");
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return retour(origin, "reponse_incomplete");

  const payload = verifyPayload(state);
  if (!payload) return retour(origin, "etat_invalide");

  let donnees: { org?: string; user?: string; at?: number };
  try {
    donnees = JSON.parse(payload) as typeof donnees;
  } catch {
    return retour(origin, "etat_invalide");
  }

  if (!donnees.org || !donnees.user || !donnees.at) return retour(origin, "etat_invalide");
  if (Date.now() - donnees.at > STATE_MAX_AGE_MS) return retour(origin, "etat_expire");

  // La signature prouve que l'état vient de nous. Elle ne prouve pas que la
  // personne qui revient est celle qui est partie : on revérifie la session.
  const { activeOrganization, user } = await requireOrganization();

  if (
    activeOrganization.organization_id !== donnees.org ||
    user.id !== donnees.user ||
    !can(activeOrganization.role, "organization:update")
  ) {
    return retour(origin, "session_differente");
  }

  const resultat = await connectCalendar({
    organizationId: activeOrganization.organization_id,
    actorUserId: user.id,
    code,
  });

  if (resultat.ok) return retour(origin, "connecte");

  // On transmet le motif exact. Un « la connexion a echoue » generique obligerait
  // a ouvrir les journaux pour savoir quoi faire (ADR-025).
  const statut =
    resultat.failure === "ECHANGE_REFUSE"
      ? "echec_google"
      : resultat.failure === "SANS_RENOUVELLEMENT"
        ? "echec_sans_renouvellement"
        : resultat.failure === "ENREGISTREMENT"
          ? "echec_enregistrement"
          : "echec";

  return retour(origin, statut);
}
