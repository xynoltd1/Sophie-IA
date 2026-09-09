import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { listLeads, searchCrm } from "@/lib/crm/queries";
import { SearchBox } from "./search-box";
import { Suspense } from "react";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { LEAD_STATUS_LABELS, contactLabel, isOpen } from "@/lib/crm/pipeline";
import { cn } from "@/lib/utils/cn";
import type { LeadStatus } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prospects — Sophie IA" };

const FILTRES = [
  { cle: "ouverts", label: "En cours" },
  { cle: "urgent", label: "Urgents" },
  { cle: "nouveau", label: "Nouveaux" },
  { cle: "tous", label: "Tous" },
] as const;

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string; q?: string }>;
}) {
  const { activeOrganization } = await requireOrganization();
  const { filtre = "ouverts", q } = await searchParams;
  const recherche = q?.trim() ?? "";
  const resultats = recherche
    ? await searchCrm(activeOrganization.organization_id, recherche)
    : [];

  const { leads, error } = await listLeads(activeOrganization.organization_id, {
    onlyOpen: filtre !== "tous",
  });

  const visibles = leads.filter((lead) => {
    if (filtre === "urgent") return lead.priority === "URGENT";
    if (filtre === "nouveau") return lead.status === "NEW";
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Prospects</SectionTitle>
        <Link
          href="/app/prospects/nouveau"
          className="flex min-h-11 items-center rounded-control bg-signal px-4 text-sm font-medium text-white"
        >
          Ajouter
        </Link>
      </div>

      <Suspense fallback={<div className="min-h-12" />}>
        <SearchBox />
      </Suspense>

      {recherche ? (
        <section>
          {resultats.length === 0 ? (
            <EmptyState
              title="Aucun résultat"
              description={`Rien ne correspond à « ${recherche} ». Essayez un nom, une ville ou quelques chiffres du numéro.`}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {resultats.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    href={item.kind === "contact" ? `/app/contacts/${item.id}` : `/app/prospects/${item.id}`}
                    className="block"
                  >
                    <Sheet className="flex flex-col gap-0.5">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-sm text-ink-soft">
                        {item.kind === "contact" ? "Client" : "Demande"}
                        {item.subtitle ? ` · ${item.subtitle}` : ""}
                      </span>
                    </Sheet>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
      <>
      <nav aria-label="Filtrer les prospects" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {FILTRES.map((item) => {
            const actif = filtre === item.cle;
            return (
              <li key={item.cle}>
                <Link
                  href={`/app/prospects?filtre=${item.cle}`}
                  aria-current={actif ? "true" : undefined}
                  className={cn(
                    "flex min-h-10 items-center whitespace-nowrap rounded-control border px-3 text-sm",
                    actif
                      ? "border-signal bg-signal-soft font-medium text-signal-deep"
                      : "border-line bg-surface text-ink-soft",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {error ? (
        <ErrorState description="La liste n’a pas pu être chargée. Rechargez la page." />
      ) : visibles.length === 0 ? (
        <EmptyState
          title="Aucun prospect ici"
          description="Ajoutez une demande à la main, ou attendez que Sophie prenne ses premiers appels."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((lead) => (
            <li key={lead.id}>
              <Link href={`/app/prospects/${lead.id}`} className="block">
                <Sheet
                  tone={
                    lead.priority === "URGENT" && isOpen(lead.status)
                      ? "urgent"
                      : lead.status === "NEW"
                        ? "attention"
                        : "neutral"
                  }
                  className="flex flex-col gap-1"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{lead.title}</p>
                    <span className="shrink-0 text-sm text-ink-soft">
                      {LEAD_STATUS_LABELS[lead.status as LeadStatus]}
                    </span>
                  </div>
                  <p className="text-sm text-ink-soft">
                    {lead.contacts ? contactLabel(lead.contacts) : "Sans contact"}
                    {lead.city ? ` · ${lead.city}` : ""}
                  </p>
                </Sheet>
              </Link>
            </li>
          ))}
        </ul>
      )}
      </>
      )}
    </div>
  );
}
