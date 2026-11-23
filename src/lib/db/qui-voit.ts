import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

/**
 * La personne en face est-elle administratrice de la plateforme ?
 *
 * Sert uniquement à choisir le niveau de détail d'un message d'erreur. Un
 * artisan reçoit « le service n'est pas complètement installé » ; nous
 * recevons le nom de la migration à appliquer.
 *
 * ## Pourquoi cette distinction existe
 *
 * Dire à un artisan d'appliquer une migration, c'est lui demander d'aller
 * dans une base de données à laquelle il n'a pas accès, pour réparer une
 * erreur qui n'est pas la sienne. Le message le plus précis n'est pas
 * toujours le plus utile : il dépend de qui peut agir.
 *
 * ## Pourquoi c'est sans risque
 *
 * La lecture passe par la session, donc par RLS : personne ne lit le profil
 * d'un autre. Et en cas de doute, la réponse est « non » — le message le plus
 * discret est celui qui ne révèle rien de notre installation.
 */
export async function estAdminPlateforme(): Promise<boolean> {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const { data } = await supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .maybeSingle();

    return data?.is_platform_admin === true;
  } catch {
    return false;
  }
}
