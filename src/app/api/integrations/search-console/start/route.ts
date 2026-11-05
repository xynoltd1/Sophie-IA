import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { signPayload } from "@/lib/crypto/secrets";
import { urlAutorisation } from "@/lib/seo/search-console";

export const dynamic = "force-dynamic";

/**
 * Départ de l'autorisation Search Console.
 *
 * La connexion est unique pour toute la plateforme : elle décrit notre site,
 * pas celui d'un client. Le garde est donc l'administrateur de plateforme, et
 * non un rôle d'organisation.
 */
export async function GET(request: NextRequest) {
  const { userId } = await requirePlatformAdmin();
  const origine = request.nextUrl.origin;

  const url = await urlAutorisation(
    origine,
    signPayload(
      JSON.stringify({ user: userId, at: Date.now(), nonce: crypto.randomUUID() }),
    ),
  );

  if (!url) {
    return NextResponse.redirect(
      new URL("/admin/seo?console=non_configure", origine),
    );
  }

  return NextResponse.redirect(url);
}
