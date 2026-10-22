import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState } from "@/components/ui/states";
import {
  CALL_STATUS_LABELS,
  formatCallMoment,
  formatDuration,
  formatPhone,
  needsAttention,
} from "@/lib/crm/calls";
import type { CallRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appels — Sophie IA" };

type Ligne = Pick<
  CallRow,
  "id" | "from_e164" | "status" | "started_at" | "duration_seconds" | "is_test" | "contact_id"
> & { contacts: { full_name: string | null; company_name: string | null } | null };

export default async function AppelsPage() {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("calls")
    .select(
      "id, from_e164, status, started_at, duration_seconds, is_test, contact_id, contacts(full_name, company_name)",
    )
    .eq("organization_id", activeOrganization.organization_id)
    .order("started_at", { ascending: false })
    .limit(50);

  const appels = (data ?? []) as unknown as Ligne[];

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Appels</SectionTitle>

      {error ? (
        <ErrorState description="Vos appels n’ont pas pu être chargés." />
      ) : appels.length === 0 ? (
        <EmptyState
          title="Aucun appel pour le moment"
          description="Chaque appel reçu par Sophie apparaîtra ici, avec son enregistrement, son résumé et sa transcription."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {appels.map((appel) => {
            const nom =
              appel.contacts?.full_name ??
              appel.contacts?.company_name ??
              formatPhone(appel.from_e164);

            return (
              <li key={appel.id}>
                <Link href={`/app/appels/${appel.id}`} className="block">
                  <Sheet
                    tone={needsAttention(appel.status) ? "attention" : "neutral"}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {nom}
                        {appel.is_test ? (
                          <span className="ml-2 rounded-control bg-ink-soft/15 px-2 py-0.5 text-xs font-normal text-ink-soft">
                            essai
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm capitalize text-ink-soft">
                        {formatCallMoment(appel.started_at)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-sm text-ink-soft">
                      <p>{CALL_STATUS_LABELS[appel.status]}</p>
                      <p>{formatDuration(appel.duration_seconds)}</p>
                    </div>
                  </Sheet>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
