import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { SectionTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/states";
import { can } from "@/lib/auth/permissions";
import { HoursEditor } from "@/app/onboarding/horaires/hours-editor";
import { WEEKDAYS, toInputTime, type HourInput } from "@/lib/org/schedule";
import type { BusinessHourRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Horaires — Sophie IA" };

export default async function HorairesReglagesPage() {
  const { activeOrganization } = await requireOrganization();
  if (!can(activeOrganization.role, "organization:update"))
    redirect("/app/reglages");

  const supabase = await createServerSupabase();
  const orgId = activeOrganization.organization_id;

  const [hours, profile] = await Promise.all([
    supabase
      .from("business_hours")
      .select("id, weekday, is_open, opens_at, closes_at")
      .eq("organization_id", orgId)
      .is("member_id", null)
      .order("weekday"),
    supabase
      .from("business_profiles")
      .select("default_appointment_minutes, buffer_minutes")
      .eq("organization_id", orgId)
      .maybeSingle(),
  ]);

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
    <div className="flex flex-col gap-5">
      <Link
        href="/app/reglages"
        className="text-sm text-ink-soft underline underline-offset-4"
      >
        ← Réglages
      </Link>
      <SectionTitle>Horaires</SectionTitle>
      <p className="text-sm text-ink-soft">
        Sophie ne proposera jamais un rendez-vous en dehors de ces plages. La
        marge est le temps laissé entre deux interventions.
      </p>

      {hours.error ? (
        <ErrorState description="Vos horaires n’ont pas pu être chargés." />
      ) : (
        <HoursEditor
          initialHours={initial}
          defaultAppointmentMinutes={
            profile.data?.default_appointment_minutes ?? 60
          }
          bufferMinutes={profile.data?.buffer_minutes ?? 15}
          contexte="REGLAGES"
        />
      )}
    </div>
  );
}
