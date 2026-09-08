import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Sonde de connectivite Supabase.
 *
 * Elle exerce reellement le chemin utilise par les pages : creation du client,
 * lecture de session, puis une requete sur une table protegee par RLS.
 * Chaque etape est isolee dans son propre try/catch pour que l'echec de l'une
 * n'empeche pas de tester les suivantes.
 *
 * Aucune valeur secrete n'est renvoyee, uniquement des messages d'erreur.
 */
export async function GET() {
  const etapes: Record<string, unknown> = {};

  try {
    const supabase = await createServerSupabase();
    etapes.client = "ok";

    try {
      const { data, error } = await supabase.auth.getUser();
      etapes.session = error
        ? { echec: error.message, statut: error.status }
        : { ok: true, connecte: Boolean(data.user) };
    } catch (error) {
      etapes.session = { exception: messageDe(error) };
    }

    try {
      // Table lisible par tout utilisateur connecte, et vide de donnees
      // sensibles : elle teste la connexion sans rien exposer.
      const { error, count } = await supabase
        .from("profession_templates")
        .select("slug", { count: "exact", head: true })
        .eq("is_published", true);

      etapes.base = error
        ? { echec: error.message, code: error.code, indice: error.hint }
        : { ok: true, metiers: count };
    } catch (error) {
      etapes.base = { exception: messageDe(error) };
    }
  } catch (error) {
    etapes.client = { exception: messageDe(error) };
  }

  return NextResponse.json({ etapes, time: new Date().toISOString() });
}

function messageDe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
