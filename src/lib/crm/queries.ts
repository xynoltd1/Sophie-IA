import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type { DashboardCounts, LeadRow, SearchResultRow } from "@/types/database";

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

  if (error || !data) return { counts: vide, error: true };

  const row = (Array.isArray(data) ? data[0] : data) as DashboardCounts | undefined;
  return { counts: row ?? vide, error: false };
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
