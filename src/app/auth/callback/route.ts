import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Point de retour d'authentification (confirmation d'e-mail, lien magique).
 * On n'accepte qu'une redirection interne : "suite" ne peut pas pointer vers
 * un domaine externe (protection contre l'open redirect).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const suite = searchParams.get("suite");
  const destination = suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?erreur=lien_invalide`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?erreur=lien_expire`);
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
