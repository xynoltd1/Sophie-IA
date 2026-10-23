import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { suitesDesAppels } from "@/lib/crm/queries";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState } from "@/components/ui/states";
import {
  CALL_STATUS_LABELS,
  appelEchoue,
  formatCallMoment,
  formatDuration,
  formatPhone,
  needsAttention,
  sansSuite,
} from "@/lib/crm/calls";
import type { CallRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appels — Sophie IA" };

type Ligne = Pick<
  CallRow,
  "id" | "from_e164" | "status" | "started_at" | "duration_seconds" | "is_test" | "contact_id"
> & { contacts: { full_name: string | null; company_name: string | null } | null };

const AUCUNE_SUITE = { leads: 0, appointments: 0, tasks: 0 };

const FILTRES = [
  { cle: "", libelle: "Tous" },
  { cle: "sans-suite", libelle: "Sans suite" },
  { cle: "echoues", libelle: "Échoués" },
] as const;

export default async function AppelsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const { filtre } = await searchParams;
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("calls")
    .select(
      "id, from_e164, status, started_at, duration_seconds, is_test, contact_id, " +
        "contacts(full_name, company_name)",
    )
    .eq("organization_id", activeOrganization.organization_id)
    .order("started_at", { ascending: false })
    .limit(50);

  const tous = (data ?? []) as unknown as Ligne[];

  // Ce que chaque appel a produit (migration 0022). C'est ce qui distingue un
  // appel traité d'un client qui attend un rappel sans que personne le sache.
  const suites = await suitesDesAppels(
    activeOrganization.organization_id,
    tous.map((a) => a.id),
  );

  const appels =
    filtre === "sans-suite"
      ? tous.filter((a) => sansSuite(a, suites.get(a.id) ?? AUCUNE_SUITE))
      : filtre === "echoues"
        ? tous.filter(appelEchoue)
        : tous;

  const actif = FILTRES.some((f) => f.cle === filtre) ? (filtre ?? "") : "";

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Appels</SectionTitle>

      <nav aria-label="Filtrer les appels" className="flex gap-2 overflow-x-auto">
        {FILTRES.map((f) => (
          <Link
            key={f.cle || "tous"}
            href={f.cle ? `/app/appels?filtre=${f.cle}` : "/app/appels"}
            aria-current={actif === f.cle ? "page" : undefined}
            className={
              actif === f.cle
                ? "flex min-h-10 shrink-0 items-center rounded-control bg-signal px-4 text-sm font-medium text-white"
                : "flex min-h-10 shrink-0 items-center rounded-control border border-line bg-surface px-4 text-sm text-ink-soft"
            }
          >
            {f.libelle}
          </Link>
        ))}
      </nav>

      {error ? (
        <ErrorState description="Vos appels n’ont pas pu être chargés." />
      ) : appels.length === 0 ? (
        <EmptyState
          title={
            actif === "sans-suite"
              ? "Aucun appel sans suite"
              : actif === "echoues"
                ? "Aucun appel échoué"
                : "Aucun appel pour le moment"
          }
          description={
            actif === "sans-suite"
              ? "Chaque appel de ces sept derniers jours a donné une demande, un rendez-vous ou un rappel."
              : actif === "echoues"
                ? "Sophie a pu répondre à tous les appels reçus."
                : "Chaque appel reçu par Sophie apparaîtra ici, avec son enregistrement, son résumé et sa transcription."
          }
          action={
            actif ? (
              <Link href="/app/appels" className="font-medium text-signal underline underline-offset-4">
                Voir tous les appels
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {appels.map((appel) => {
            const nom =
              appel.contacts?.full_name ??
              appel.contacts?.company_name ??
              formatPhone(appel.from_e164);

            const rien = sansSuite(appel, suites.get(appel.id) ?? AUCUNE_SUITE);

            return (
              <li key={appel.id}>
                <Link href={`/app/appels/${appel.id}`} className="block">
                  <Sheet
                    tone={needsAttention(appel.status) || rien ? "attention" : "neutral"}
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
                      <p className="text-sm text-ink-soft first-letter:uppercase">
                        {formatCallMoment(appel.started_at)}
                      </p>
                      {rien ? (
                        <p className="text-sm text-attention">
                          Rien n’a été noté pendant cet appel.
                        </p>
                      ) : null}
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
