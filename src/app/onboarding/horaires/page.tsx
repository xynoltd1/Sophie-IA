import { requireStep } from "../guard";
import { StepShell } from "../step-shell";
import { HoursEditor } from "./hours-editor";
import { ErrorState } from "@/components/ui/states";
import { WEEKDAYS, toInputTime, type HourInput } from "@/lib/org/schedule";
import type { BusinessHourRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vos horaires — Sophie IA" };

export default async function ScheduleStep() {
  const { organization, supabase } = await requireStep("SCHEDULE");

  const [hours, profile] = await Promise.all([
    supabase
      .from("business_hours")
      .select("id, weekday, is_open, opens_at, closes_at")
      .eq("organization_id", organization.organization_id)
      .is("member_id", null)
      .order("weekday"),
    supabase
      .from("business_profiles")
      .select("default_appointment_minutes, buffer_minutes")
      .eq("organization_id", organization.organization_id)
      .maybeSingle(),
  ]);

  if (hours.error) {
    return (
      <StepShell
        step="SCHEDULE"
        title="Vos horaires"
        intro="Vos horaires n'ont pas pu être chargés."
        backHref="/onboarding/services"
      >
        <ErrorState description="Rechargez la page pour réessayer." />
      </StepShell>
    );
  }

  const rows = (hours.data ?? []) as Pick<
    BusinessHourRow,
    "id" | "weekday" | "is_open" | "opens_at" | "closes_at"
  >[];

  const initial: HourInput[] = WEEKDAYS.map((day) => {
    const row = rows.find((r) => r.weekday === day.value);
    return {
      weekday: day.value,
      is_open: row?.is_open ?? day.value <= 5,
      opens_at: toInputTime(row?.opens_at ?? null) || "08:00",
      closes_at: toInputTime(row?.closes_at ?? null) || "17:00",
    };
  });

  return (
    <StepShell
      step="SCHEDULE"
      title="Vos horaires"
      intro="Sophie ne proposera jamais un rendez-vous en dehors de ces plages."
      backHref="/onboarding/services"
    >
      <HoursEditor
        initialHours={initial}
        defaultAppointmentMinutes={profile.data?.default_appointment_minutes ?? 60}
        bufferMinutes={profile.data?.buffer_minutes ?? 15}
      />
    </StepShell>
  );
}
