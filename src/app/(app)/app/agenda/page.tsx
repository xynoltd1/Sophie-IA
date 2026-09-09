import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { BookingPanel } from "./booking-panel";
import { AppointmentActions } from "./appointment-actions";
import {
  APPOINTMENT_STATUS_LABELS,
  formatDay,
  formatTime,
  needsApproval,
  todayISO,
} from "@/lib/crm/agenda";
import type { AppointmentRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda — Sophie IA" };

export default async function AgendaPage() {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const [rdvRes, agendaRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, title, starts_at, ends_at, status, city, contact_id")
      .eq("organization_id", activeOrganization.organization_id)
      .in("status", ["PENDING_APPROVAL", "CONFIRMED", "CHANGE_PROPOSED"])
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(50),
    supabase
      .from("calendar_status")
      .select("provider, is_active")
      .eq("organization_id", activeOrganization.organization_id)
      .maybeSingle(),
  ]);

  const rendezVous = (rdvRes.data ?? []) as Pick<
    AppointmentRow,
    "id" | "title" | "starts_at" | "ends_at" | "status" | "city" | "contact_id"
  >[];

  const agendaConnecte = Boolean(agendaRes.data?.is_active);

  // Regroupement par jour : un artisan raisonne en journées, pas en liste.
  const parJour = new Map<string, typeof rendezVous>();
  for (const rdv of rendezVous) {
    const cle = formatDay(rdv.starts_at);
    parJour.set(cle, [...(parJour.get(cle) ?? []), rdv]);
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Agenda</SectionTitle>

      {!agendaConnecte ? (
        <Sheet tone="attention" className="flex flex-col gap-1">
          <p className="font-medium">Agenda Google non connecté</p>
          <p className="text-sm text-ink-soft">
            Les créneaux proposés tiennent compte de vos horaires et de vos rendez-vous
            enregistrés ici, mais pas de votre agenda Google.
          </p>
        </Sheet>
      ) : null}

      <BookingPanel
        defaultDay={todayISO()}
        organizationId={activeOrganization.organization_id}
      />

      <section>
        <SectionTitle>À venir</SectionTitle>
        {rdvRes.error ? (
          <ErrorState description="Vos rendez-vous n’ont pas pu être chargés." />
        ) : rendezVous.length === 0 ? (
          <EmptyState
            title="Aucun rendez-vous à venir"
            description="Réservez un créneau ci-dessus, ou attendez que Sophie en propose."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {[...parJour.entries()].map(([jour, liste]) => (
              <div key={jour}>
                <h3 className="mb-2 text-sm font-medium capitalize text-ink-soft">{jour}</h3>
                <ul className="flex flex-col gap-2">
                  {liste.map((rdv) => (
                    <li key={rdv.id}>
                      <Sheet
                        tone={needsApproval(rdv.status) ? "attention" : "neutral"}
                        className="flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">{rdv.title}</p>
                            <p className="text-sm text-ink-soft">
                              {formatTime(rdv.starts_at)} – {formatTime(rdv.ends_at)}
                              {rdv.city ? ` · ${rdv.city}` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm text-ink-soft">
                            {APPOINTMENT_STATUS_LABELS[rdv.status]}
                          </span>
                        </div>
                        <AppointmentActions appointmentId={rdv.id} status={rdv.status} />
                      </Sheet>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
