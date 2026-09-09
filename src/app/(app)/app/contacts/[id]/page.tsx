import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";
import { ContactPanels } from "./contact-panels";
import { LEAD_STATUS_LABELS, contactLabel, isOpen, isOverdue } from "@/lib/crm/pipeline";
import type { ContactRow, LeadRow, TaskRow } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * Fiche contact (section 32).
 *
 * L'historique est chronologique et volontairement extensible : il accueillera
 * les appels, les SMS et les rendez-vous aux phases suivantes. Aujourd'hui il
 * ne montre que les prospects, mais la forme est celle qui durera.
 */
export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();
  const orgId = activeOrganization.organization_id;

  const [contactRes, leadsRes, tasksRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle(),
    supabase
      .from("leads")
      .select("id, title, status, priority, created_at")
      .eq("contact_id", id)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, title, status, due_at, priority")
      .eq("contact_id", id)
      .eq("organization_id", orgId)
      .order("due_at", { ascending: true, nullsFirst: false }),
  ]);

  if (!contactRes.data) notFound();

  const contact = contactRes.data as ContactRow;
  const leads = (leadsRes.data ?? []) as Pick<
    LeadRow,
    "id" | "title" | "status" | "priority" | "created_at"
  >[];
  const tasks = (tasksRes.data ?? []) as Pick<
    TaskRow,
    "id" | "title" | "status" | "due_at" | "priority"
  >[];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/app/prospects" className="text-sm text-ink-soft underline underline-offset-4">
        Retour
      </Link>

      <section>
        <h1 className="font-display text-2xl font-semibold leading-tight">
          {contactLabel(contact)}
        </h1>
        {contact.is_provisional ? (
          <p className="mt-1 text-sm text-attention">
            Fiche créée automatiquement, à compléter.
          </p>
        ) : null}
        {contact.phone ? (
          <a
            href={`tel:${contact.phone.replace(/\s/g, "")}`}
            className="mt-3 flex min-h-12 items-center justify-center rounded-control bg-signal px-4 font-medium text-white"
          >
            Appeler {contact.phone}
          </a>
        ) : null}
      </section>

      <section>
        <SectionTitle>Prospects</SectionTitle>
        {leads.length === 0 ? (
          <EmptyState
            title="Aucune demande"
            description="Les demandes de ce client apparaîtront ici."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {leads.map((lead) => (
              <li key={lead.id}>
                <Link href={`/app/prospects/${lead.id}`} className="block">
                  <Sheet
                    tone={lead.priority === "URGENT" && isOpen(lead.status) ? "urgent" : "neutral"}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="font-medium">{lead.title}</span>
                    <span className="shrink-0 text-sm text-ink-soft">
                      {LEAD_STATUS_LABELS[lead.status]}
                    </span>
                  </Sheet>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ContactPanels
        contact={contact}
        tasks={tasks.map((task) => ({ ...task, overdue: isOverdue(task) }))}
      />
    </div>
  );
}
