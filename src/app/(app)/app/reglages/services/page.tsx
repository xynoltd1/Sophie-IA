import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { SectionTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/states";
import { can } from "@/lib/auth/permissions";
import { ServicesEditor } from "@/app/onboarding/services/services-editor";
import type { ServiceRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Services — Sophie IA" };

export default async function ServicesReglagesPage() {
  const { activeOrganization } = await requireOrganization();
  if (!can(activeOrganization.role, "organization:update")) redirect("/app/reglages");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, duration_minutes, is_urgent, is_active, price_indication, source, sort_order")
    .eq("organization_id", activeOrganization.organization_id)
    .order("sort_order");

  return (
    <div className="flex flex-col gap-5">
      <Link href="/app/reglages" className="text-sm text-ink-soft underline underline-offset-4">
        ← Réglages
      </Link>
      <SectionTitle>Services</SectionTitle>
      <p className="text-sm text-ink-soft">
        Sophie ne propose que les services actifs, et n’annonce que les durées indiquées
        ici. Elle n’invente jamais un service absent de cette liste.
      </p>

      {error ? (
        <ErrorState description="Vos services n’ont pas pu être chargés." />
      ) : (
        <ServicesEditor services={(data ?? []) as ServiceRow[]} contexte="REGLAGES" />
      )}
    </div>
  );
}
