import { NextResponse } from "next/server";
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";

/**
 * Sonde de disponibilite et de configuration.
 *
 * Elle indique si chaque variable requise est PRESENTE, jamais sa valeur.
 * Sans cela, une application deployee sans configuration renvoie une erreur
 * opaque et il faut fouiller les journaux pour comprendre.
 */
export function GET() {
  const config = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  const missing = Object.entries(config)
    .filter(([, present]) => !present)
    .map(([name]) => name);

  return NextResponse.json(
    {
      status: missing.length === 0 ? "ok" : "configuration_incomplete",
      version: pkg.version,
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? "non defini",
      config,
      missing,
      time: new Date().toISOString(),
    },
    { status: missing.length === 0 ? 200 : 503 },
  );
}
