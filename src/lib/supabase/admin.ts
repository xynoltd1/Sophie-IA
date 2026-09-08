import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv, serviceRoleKey } from "@/lib/env";

/**
 * Client d'administration : contourne RLS.
 *
 * A n'utiliser que pour :
 *   - les webhooks entrants (aucune session utilisateur) ;
 *   - les traitements asynchrones (jobs) ;
 *   - la console d'administration de la plateforme.
 *
 * Toute utilisation doit etre precedee d'un controle d'autorisation explicite
 * cote serveur et suivie d'une ecriture dans public.audit_logs.
 * L'import de "server-only" fait echouer la compilation si ce module est
 * atteint depuis un composant client.
 */
export function createAdminClient() {
  const env = publicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
