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
