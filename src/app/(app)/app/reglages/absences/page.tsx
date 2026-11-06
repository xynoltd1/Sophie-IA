import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { SectionTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/states";
import { can } from "@/lib/auth/permissions";
import { AbsencesEditor, type LigneAbsence } from "./absences-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Absences — Zelicall" };

export default async function AbsencesPage() {
  const { activeOrganization } = await requireOrganization();
  if (!can(activeOrganization.role, "organization:update"))
    redirect("/app/reglages");

  const supabase = await createServerSupabase();
  const orgId = activeOrganization.organization_id;

  const [absences, org] = await Promise.all([
    supabase
      .from("absences")
      .select("id, kind, label, starts_at, ends_at")
      .eq("organization_id", orgId)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at"),
    supabase
      .from("organizations")
      .select("timezone")
      .eq("id", orgId)
      .maybeSingle(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/app/reglages"
        className="text-sm text-ink-soft underline underline-offset-4"
      >
        ← Réglages
      </Link>
      <SectionTitle>Absences et vacances</SectionTitle>
      <p className="text-sm text-ink-soft">
        Pendant ces périodes, Zeli ne proposera aucun créneau. Les rendez-vous
        déjà confirmés ne sont pas touchés : à vous de prévenir ces clients.
      </p>

      {absences.error ? (
        <ErrorState description="Vos absences n’ont pas pu être chargées." />
      ) : (
        <AbsencesEditor
          absences={(absences.data ?? []) as LigneAbsence[]}
          timezone={
            (org.data?.timezone as string | undefined) ?? "Europe/Brussels"
          }
        />
      )}
    </div>
  );
}
