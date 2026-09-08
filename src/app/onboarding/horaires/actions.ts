"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { isEveryDayClosed, validateHours, type HourInput } from "@/lib/org/schedule";

const hourSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  is_open: z.boolean(),
  opens_at: z.string(),
  closes_at: z.string(),
});

const payload = z.object({
  hours: z.array(hourSchema).length(7),
  defaultAppointmentMinutes: z.number().int().min(5).max(1440),
  bufferMinutes: z.number().int().min(0).max(240),
});

export interface HoursState {
  error?: string;
  dayErrors?: Record<number, string>;
}

export async function saveHours(input: unknown): Promise<HoursState> {
  const parsed = payload.safeParse(input);
  if (!parsed.success) {
    return { error: "Les horaires envoyés sont incomplets. Rechargez la page." };
  }

  const hours = parsed.data.hours as HourInput[];

  const dayErrors = validateHours(hours);
  if (Object.keys(dayErrors).length > 0) {
    return { dayErrors };
  }

  if (isEveryDayClosed(hours)) {
    return {
      error:
        "Gardez au moins un jour d'ouverture : sans cela, Sophie ne pourrait proposer aucun rendez-vous.",
    };
  }

  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();
  const orgId = activeOrganization.organization_id;

  for (const hour of hours) {
    const { error } = await supabase
      .from("business_hours")
      .update({
        is_open: hour.is_open,
        opens_at: hour.is_open ? hour.opens_at : null,
        closes_at: hour.is_open ? hour.closes_at : null,
      })
      .eq("organization_id", orgId)
      .is("member_id", null)
      .eq("weekday", hour.weekday);

    if (error) {
      return { error: "Les horaires n'ont pas pu être enregistrés. Réessayez." };
    }
  }

  const profile = await supabase
    .from("business_profiles")
    .update({
      default_appointment_minutes: parsed.data.defaultAppointmentMinutes,
      buffer_minutes: parsed.data.bufferMinutes,
    })
    .eq("organization_id", orgId);

  if (profile.error) {
    return { error: "Les horaires sont enregistrés, mais pas les durées de rendez-vous." };
  }

  await supabase.rpc("set_onboarding_step", { org_id: orgId, step: "CALENDAR" });
  redirect("/onboarding/agenda");
}
