import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { MessagesContact, type LigneMessage } from "./messages";
import { FilContact } from "./timeline";
import { construireFil } from "@/lib/crm/timeline";
import { EmptyState } from "@/components/ui/states";
import { ContactPanels } from "./contact-panels";
import {
  LEAD_STATUS_LABELS,
  contactLabel,
  isOpen,
  isOverdue,
} from "@/lib/crm/pipeline";
import type { ContactRow, LeadRow, TaskRow } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * Fiche contact (section 32).
 *
 * L'historique est chronologique et volontairement extensible : il accueillera
 * les appels, les SMS et les rendez-vous aux phases suivantes. Aujourd'hui il
 * ne montre que les prospects, mais la forme est celle qui durera.
 */
export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();
  const orgId = activeOrganization.organization_id;

  const [
    contactRes,
    leadsRes,
    tasksRes,
    messagesRes,
    appelsRes,
    rdvRes,
    filRes,
  ] = await Promise.all([
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
    supabase
      .from("outbound_messages")
      .select("id, body, status, last_error, created_at, attempts")
      .eq("contact_id", id)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("calls")
      .select("id, started_at, duration_seconds, status")
      .eq("contact_id", id)
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false })
      .limit(20),
    supabase
      .from("appointments")
      .select("id, title, starts_at, status")
      .eq("contact_id", id)
      .eq("organization_id", orgId)
      .order("starts_at", { ascending: false })
      .limit(20),
    // Jointure stricte sur la conversation : sans elle, cette requete
    // ramenerait les messages entrants de TOUS les contacts de l entreprise
    // et les afficherait dans l historique de celui-ci.
    supabase
      .from("conversation_messages")
      .select(
        "id, body, direction, occurred_at, conversations!inner(contact_id)",
      )
      .eq("organization_id", orgId)
      .eq("conversations.contact_id", id)
      .eq("direction", "INBOUND")
      .order("occurred_at", { ascending: false })
      .limit(20),
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
  const messages = (messagesRes.data ?? []) as LigneMessage[];

  // Le fil réunit ce que quatre tables savent séparément (section 32).
  const fil = construireFil({
    appels: (appelsRes.data ?? []) as {
      id: string;
      started_at: string;
      duration_seconds: number | null;
      status: string;
    }[],
    messages: [
      ...messages.map((m) => ({
        id: m.id,
        body: m.body,
        created_at: m.created_at,
        direction: "OUTBOUND" as const,
      })),
      ...(
        (filRes.data ?? []) as {
          id: string;
          body: string;
          occurred_at: string;
        }[]
      ).map((m) => ({
        id: m.id,
        body: m.body,
        created_at: m.occurred_at,
        direction: "INBOUND" as const,
      })),
    ],
    rendezVous: (rdvRes.data ?? []) as {
      id: string;
      title: string;
      starts_at: string;
      status: string;
    }[],
    demandes: leads.map((l) => ({
      id: l.id,
      title: l.title,
      created_at: l.created_at,
      status: l.status,
    })),
  });

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/app/prospects"
        className="text-sm text-ink-soft underline underline-offset-4"
      >
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
          <>
            <a
              href={`tel:${contact.phone.replace(/\s/g, "")}`}
              className="mt-3 flex min-h-12 items-center justify-center rounded-control bg-signal px-4 font-medium text-white"
            >
              Appeler {contact.phone}
            </a>
            {contact.phone_origin === "DICTATED" ? (
              /* Un numéro dicté a traversé la reconnaissance vocale. Le dire
                 AVANT que l'artisan compose évite deux pertes : son temps, et
                 la tranquillité de l'inconnu qu'il risque d'appeler. */
              <p className="mt-2 text-sm text-attention">
                Numéro communiqué par l’appelant, pas transmis par l’opérateur.
                À vérifier.
              </p>
            ) : null}
          </>
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
                    interactive
                    tone={
                      lead.priority === "URGENT" && isOpen(lead.status)
                        ? "urgent"
                        : "neutral"
                    }
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

      <MessagesContact messages={messages} />

      <FilContact evenements={fil} />

      <ContactPanels
        contact={contact}
        tasks={tasks.map((task) => ({ ...task, overdue: isOverdue(task) }))}
      />
    </div>
  );
}
