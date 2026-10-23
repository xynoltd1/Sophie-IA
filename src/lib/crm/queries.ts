import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type {
  DashboardCounts,
  DayAppointmentRow,
  LeadRow,
  SearchResultRow,
} from "@/types/database";

/**
 * Compteurs de l'accueil.
 *
 * En cas d'échec on renvoie des zéros plutôt que de faire planter la page :
 * l'accueil est l'écran que l'artisan ouvre en premier, il doit toujours
 * s'afficher. L'erreur est signalée à l'appelant pour qu'il puisse le dire.
 */
export async function getDashboardCounts(
  organizationId: string,
): Promise<{ counts: DashboardCounts; error: boolean }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("dashboard_counts", { org_id: organizationId });

  const vide: DashboardCounts = {
    urgent_leads: 0,
    new_leads: 0,
    overdue_tasks: 0,
    tasks_today: 0,
    open_leads: 0,
    contacts_total: 0,
    pending_appointments: 0,
    calls_no_followup: 0,
    calls_failed: 0,
  };

  if (error) return { counts: vide, error: true };

  // Un tableau vide n'est pas un succes a zero : la fonction renvoie toujours
  // une ligne. Le traiter comme un resultat valide masquait un echec silencieux
  // derriere un « Rien ne vous attend » rassurant.
  const row = (Array.isArray(data) ? data[0] : data) as DashboardCounts | undefined;
  if (!row) return { counts: vide, error: true };

  return { counts: row, error: false };
}

export interface LeadWithContact extends LeadRow {
  contacts: { id: string; full_name: string | null; company_name: string | null; phone: string | null } | null;
}

export async function listLeads(
  organizationId: string,
  options: { onlyOpen?: boolean } = {},
): Promise<{ leads: LeadWithContact[]; error: boolean }> {
  const supabase = await createServerSupabase();

  let query = supabase
    .from("leads")
    .select(
      "id, organization_id, contact_id, service_id, title, description, status, priority, address_line1, postal_code, city, requested_at, source, closed_at, close_reason, created_at, updated_at, contacts(id, full_name, company_name, phone)",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (options.onlyOpen) {
    query = query.not("status", "in", "(WON,LOST)");
  }

  const { data, error } = await query;
  return { leads: (data ?? []) as unknown as LeadWithContact[], error: Boolean(error) };
}

export async function searchCrm(
  organizationId: string,
  terme: string,
): Promise<SearchResultRow[]> {
  if (!terme.trim()) return [];

  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("search_crm", {
    org_id: organizationId,
    terme,
    limite: 20,
  });

  return (data ?? []) as SearchResultRow[];
}

/**
 * Rendez-vous du jour, pour l'accueil.
 *
 * La date est calculée en base, dans le fuseau de l'entreprise : « aujourd'hui »
 * à Bruxelles n'est pas « aujourd'hui » en UTC pendant une partie de la journée.
 */
export async function getTodayAppointments(
  organizationId: string,
): Promise<DayAppointmentRow[]> {
  const supabase = await createServerSupabase();

  const jour = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const { data, error } = await supabase.rpc("appointments_for_day", {
    org_id: organizationId,
    jour,
  });

  if (error) return [];
  return (data ?? []) as DayAppointmentRow[];
}

/**
 * Ce que chaque appel a produit : demandes, rendez-vous, rappels.
 *
 * Trois requêtes plates plutôt qu'un comptage embarqué. PostgREST sait compter
 * une relation dans la même requête, mais il faut qu'il déduise seul le lien
 * entre `calls` et trois autres tables, et cette déduction n'échoue qu'à
 * l'exécution, sur la page la plus importante du produit. Trois `in (...)` sur
 * au plus cinquante identifiants ne coûtent rien et ne peuvent pas surprendre.
 */
export async function suitesDesAppels(
  organizationId: string,
  callIds: string[],
): Promise<Map<string, { leads: number; appointments: number; tasks: number }>> {
  const resultat = new Map<string, { leads: number; appointments: number; tasks: number }>();
  for (const id of callIds) resultat.set(id, { leads: 0, appointments: 0, tasks: 0 });
  if (callIds.length === 0) return resultat;

  const supabase = await createServerSupabase();

  const requete = (table: "leads" | "appointments" | "tasks") =>
    supabase
      .from(table)
      .select("call_id")
      .eq("organization_id", organizationId)
      .in("call_id", callIds);

  const [leads, rdvs, taches] = await Promise.all([
    requete("leads"),
    requete("appointments"),
    requete("tasks"),
  ]);

  const compter = (
    lignes: { call_id: string | null }[] | null,
    champ: "leads" | "appointments" | "tasks",
  ) => {
    for (const ligne of lignes ?? []) {
      if (!ligne.call_id) continue;
      const entree = resultat.get(ligne.call_id);
      if (entree) entree[champ] += 1;
    }
  };

  compter(leads.data as { call_id: string | null }[] | null, "leads");
  compter(rdvs.data as { call_id: string | null }[] | null, "appointments");
  compter(taches.data as { call_id: string | null }[] | null, "tasks");

  return resultat;
}
