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
import { getCalendarState, calendarMessage } from "@/lib/crm/calendar-state";
import { ensureCalendarFresh } from "@/lib/providers/calendar/service";
import Link from "next/link";
import type { AppointmentRow } from "@/types/database";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda — Sophie IA" };

export default async function AgendaPage() {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  // La tâche planifiee ne tourne qu'une fois par jour sur Vercel Hobby
  // (ADR-024). On rafraîchit donc ici, au moment où l'affichage en dépend.
  // Ne lève jamais : un échec se traduit par un agenda marqué « périmé ».
  await ensureCalendarFresh(activeOrganization.organization_id);

  const [rdvRes, agendaRes] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, title, starts_at, ends_at, status, city, contact_id, external_sync_error",
      )
      .eq("organization_id", activeOrganization.organization_id)
      .in("status", ["PENDING_APPROVAL", "CONFIRMED", "CHANGE_PROPOSED"])
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(50),
    getCalendarState(activeOrganization.organization_id),
  ]);

  const rendezVous = (rdvRes.data ?? []) as (Pick<
    AppointmentRow,
    "id" | "title" | "starts_at" | "ends_at" | "status" | "city" | "contact_id"
  > & { external_sync_error: string | null })[];

  const calendrier = agendaRes;

  // Regroupement par jour : un artisan raisonne en journées, pas en liste.
  const parJour = new Map<string, typeof rendezVous>();
  for (const rdv of rendezVous) {
    const cle = formatDay(rdv.starts_at);
    parJour.set(cle, [...(parJour.get(cle) ?? []), rdv]);
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Agenda</SectionTitle>

      {calendrier.confidence !== "FRESH" ? (
        <Sheet tone="attention" className="flex flex-col gap-2">
          <p className="font-medium">
            {calendrier.confidence === "EXPIRED"
              ? "Autorisation Google expirée"
              : calendrier.connected
                ? "Synchronisation de l\u2019agenda en retard"
                : "Agenda Google non connecté"}
          </p>
          <p className="text-sm text-ink-soft">{calendarMessage(calendrier)}</p>
          <Link
            href="/app/plus"
            className="text-sm font-medium text-signal underline underline-offset-4"
          >
            {calendrier.confidence === "EXPIRED"
              ? "Reconnecter mon agenda"
              : calendrier.connected
                ? "Vérifier dans les paramètres"
                : "Connecter mon agenda"}
          </Link>
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
                {/* Un en-tête de journée est un repère de structure, pas une
                    légende : il se lit avant les rendez-vous qu'il annonce. */}
                <h3 className="mb-2 flex items-center gap-3 font-display text-base font-semibold first-letter:uppercase">
                  {jour}
                  <span aria-hidden className="h-px flex-1 bg-line" />
                </h3>
                <ul className="flex flex-col gap-2">
                  {liste.map((rdv) => (
                    <li key={rdv.id}>
                      <Sheet
                        tone={
                          needsApproval(rdv.status) ? "attention" : "neutral"
                        }
                        className="flex flex-col gap-2"
                      >
                        {/* L'heure mène la ligne. Un artisan lit sa journée
                            par heures — « 8 h chez Dupont » — et non par
                            intitulés d'intervention. */}
                        <div className="flex items-start gap-3.5">
                          <span className="tabular shrink-0 text-lg font-semibold leading-tight">
                            {formatTime(rdv.starts_at)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{rdv.title}</p>
                            <p className="text-sm text-ink-soft">
                              jusqu’à {formatTime(rdv.ends_at)}
                              {rdv.city ? ` · ${rdv.city}` : ""}
                            </p>
                          </div>
                          <Badge
                            ton={
                              needsApproval(rdv.status) ? "attention" : "neutre"
                            }
                          >
                            {APPOINTMENT_STATUS_LABELS[rdv.status]}
                          </Badge>
                        </div>
                        {rdv.external_sync_error ? (
                          <p className="text-sm text-attention">
                            Pas encore écrit dans votre agenda Google.
                          </p>
                        ) : null}
                        <AppointmentActions
                          appointmentId={rdv.id}
                          status={rdv.status}
                          syncError={Boolean(rdv.external_sync_error)}
                        />
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
