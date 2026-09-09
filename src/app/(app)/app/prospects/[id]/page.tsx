import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { StatusActions } from "./status-actions";
import {
  LEAD_STATUS_LABELS,
  PRIORITY_LABELS,
  contactLabel,
  nextStatuses,
} from "@/lib/crm/pipeline";
import type { LeadStatus, LeadPriority } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("leads")
    .select(
      "id, title, description, status, priority, city, created_at, contacts(id, full_name, company_name, phone, email, city)",
    )
    .eq("id", id)
    .eq("organization_id", activeOrganization.organization_id)
    .maybeSingle();

  if (!data) notFound();

  const lead = data as unknown as {
    id: string;
    title: string;
    description: string | null;
    status: LeadStatus;
    priority: LeadPriority;
    city: string | null;
    created_at: string;
    contacts: {
      id: string;
      full_name: string | null;
      company_name: string | null;
      phone: string | null;
      email: string | null;
      city: string | null;
    } | null;
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/app/prospects" className="text-sm text-ink-soft underline underline-offset-4">
        Retour aux prospects
      </Link>

      <section>
        <h1 className="font-display text-2xl font-semibold leading-tight">{lead.title}</h1>
        <p className="mt-1 text-ink-soft">
          {LEAD_STATUS_LABELS[lead.status]} · {PRIORITY_LABELS[lead.priority]}
        </p>
      </section>

      {lead.contacts ? (
        <section>
          <SectionTitle>Client</SectionTitle>
          <Sheet className="flex flex-col gap-1">
            <Link
              href={`/app/contacts/${lead.contacts.id}`}
              className="font-medium underline underline-offset-4"
            >
              {contactLabel(lead.contacts)}
            </Link>
            {lead.contacts.phone ? (
              <a
                href={`tel:${lead.contacts.phone.replace(/\s/g, "")}`}
                className="text-signal underline underline-offset-4"
              >
                {lead.contacts.phone}
              </a>
            ) : null}
            {lead.contacts.city ? (
              <p className="text-sm text-ink-soft">{lead.contacts.city}</p>
            ) : null}
          </Sheet>
        </section>
      ) : null}

      {lead.description ? (
        <section>
          <SectionTitle>Détails</SectionTitle>
          <Sheet>
            <p className="whitespace-pre-wrap text-ink">{lead.description}</p>
          </Sheet>
        </section>
      ) : null}

      <section>
        <SectionTitle>Faire avancer</SectionTitle>
        <StatusActions leadId={lead.id} options={[...nextStatuses(lead.status)]} />
      </section>
    </div>
  );
}
