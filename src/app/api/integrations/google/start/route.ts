import { NextResponse, type NextRequest } from "next/server";
import { requireOrganization } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { signPayload } from "@/lib/crypto/secrets";
import { getCalendarProvider } from "@/lib/providers/calendar/service";
import { googleCalendarConfigured } from "@/lib/providers/calendar/google";

export const dynamic = "force-dynamic";

/**
 * Départ de l'autorisation Google.
 *
 * Le paramètre `state` est signé et contient l'organisation, l'utilisateur et
 * un horodatage. Sans cette signature, un tiers pourrait forger un retour
 * d'autorisation et rattacher son propre agenda à l'organisation d'un autre.
 */
export async function GET(request: NextRequest) {
  const { activeOrganization, user } = await requireOrganization();

  if (!can(activeOrganization.role, "organization:update")) {
    return NextResponse.redirect(
      new URL("/app/plus?agenda=droits_insuffisants", request.nextUrl.origin),
    );
  }

  if (!googleCalendarConfigured()) {
    return NextResponse.redirect(
      new URL("/app/plus?agenda=non_configure", request.nextUrl.origin),
    );
  }

  const state = signPayload(
    JSON.stringify({
      org: activeOrganization.organization_id,
      user: user.id,
      at: Date.now(),
      nonce: crypto.randomUUID(),
    }),
  );

  return NextResponse.redirect(getCalendarProvider().authorizationUrl(state));
}
