import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Rafraichit la session a chaque requete et bloque l'acces aux routes privees.
 *
 * Le middleware est une commodite, pas la securite du produit : l'autorisation
 * reelle est appliquee par RLS dans PostgreSQL. Meme si ce fichier etait
 * contourne, une organisation ne pourrait pas lire les donnees d'une autre.
 */
const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/api/health"];

export async function middleware(request: NextRequest) {
  // Sans configuration Supabase, chaque page leve une exception et l'utilisateur
  // ne voit qu'un « Application error » opaque. On preferele dire clairement,
  // avec le nom des variables manquantes.
  const missing = [
    !process.env.NEXT_PUBLIC_SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean);

  if (missing.length > 0) {
    return new NextResponse(
      `Configuration incomplete.\n\nVariables manquantes : ${missing.join(", ")}\n\n` +
        "Sur Vercel : Project Settings > Environment Variables, puis relancez un " +
        "deploiement en decochant « Use existing Build Cache ».\n" +
        "Diagnostic detaille : /api/health",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("suite", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)"],
};
