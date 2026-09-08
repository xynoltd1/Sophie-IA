"use server";

import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

export async function continueToSophie() {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  await supabase.rpc("set_onboarding_step", {
    org_id: activeOrganization.organization_id,
    step: "SOPHIE",
  });

  redirect("/onboarding/sophie");
}
