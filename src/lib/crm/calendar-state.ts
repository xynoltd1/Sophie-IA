import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Ce que l'application sait de l'agenda externe, au moment de proposer des
 * créneaux.
 *
 * Trois situations distinctes, et il ne faut pas les confondre :
 *  - aucun agenda connecté : on ne voit que nos propres rendez-vous ;
 *  - connecté et à jour : les créneaux proposés sont fiables ;
 *  - connecté mais périmé : on ne peut PAS affirmer qu'un créneau est libre.
 *
 * Le troisième cas est le plus dangereux, parce qu'il ressemble au deuxième.
 * Section 19 : Sophie ne doit jamais inventer une disponibilité.
 */
export type CalendarConfidence =
  | "NOT_CONNECTED"
  | "FRESH"
  | "STALE"
  /**
   * Connecté en apparence, mais l'autorisation est morte. Distinct de STALE :
   * rien ne se réparera tout seul, et seul le professionnel peut agir.
   */
  | "EXPIRED";

export interface CalendarState {
  confidence: CalendarConfidence;
  connected: boolean;
  account: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export async function getCalendarState(organizationId: string): Promise<CalendarState> {
  const supabase = await createServerSupabase();

  const [statut, syncState] = await Promise.all([
    supabase
      .from("calendar_status")
      .select("external_account, is_active, last_synced_at, last_error")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase.rpc("calendar_sync_state", { org_id: organizationId }),
  ]);

  const ligne = Array.isArray(syncState.data) ? syncState.data[0] : syncState.data;
  const connected = Boolean(ligne?.connected ?? statut.data?.is_active);
  const isFresh = Boolean(ligne?.is_fresh);

  const erreur = (ligne?.last_error as string | null) ?? statut.data?.last_error ?? null;

  // Une autorisation expirée ne se distingue pas d'un simple retard dans les
  // données, mais appelle une action complètement différente : attendre ne
  // sert à rien, il faut reconnecter.
  const expire = Boolean(erreur && /expir|révoqu|revoqu|invalid_grant/i.test(erreur));

  return {
    confidence: !connected
      ? "NOT_CONNECTED"
      : expire
        ? "EXPIRED"
        : isFresh
          ? "FRESH"
          : "STALE",
    connected,
    account: (statut.data?.external_account as string | null) ?? null,
    lastSyncedAt: (ligne?.last_synced_at as string | null) ?? null,
    lastError: (ligne?.last_error as string | null) ?? null,
  };
}

/**
 * Phrase à afficher au professionnel. Elle dit ce que Sophie voit, et surtout
 * ce qu'elle ne voit pas.
 */
export function calendarMessage(state: CalendarState): string {
  switch (state.confidence) {
    case "FRESH":
      return `Agenda Google connecté${state.account ? ` (${state.account})` : ""}. Sophie tient compte de vos rendez-vous personnels.`;
    case "EXPIRED":
      return "L'autorisation Google a expiré. Sophie ne voit plus votre agenda : reconnectez-le pour qu'elle recommence à proposer des créneaux.";
    case "STALE":
      return "Agenda Google connecté, mais la dernière synchronisation est ancienne. Vérifiez vos créneaux avant de confirmer.";
    case "NOT_CONNECTED":
      return "Agenda Google non connecté. Sophie ne voit que les rendez-vous enregistrés ici, pas ceux de votre agenda personnel.";
  }
}
