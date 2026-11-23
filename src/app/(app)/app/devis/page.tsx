import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { listerDevis } from "@/lib/quotes/queries";
import { ETATS_DEVIS, euros } from "@/lib/quotes/totals";
import { BoutonNouveauDevis } from "./nouveau";

export const dynamic = "force-dynamic";
export const metadata = { title: "Devis — Zelicall" };

const TONS: Record<string, string> = {
  neutre: "bg-ink-tint text-ink-soft",
  signal: "bg-signal-soft text-signal",
  attention: "bg-attention-soft text-attention",
  urgent: "bg-urgent-soft text-urgent",
};

export default async function DevisPage() {
  const { activeOrganization: org } = await requireOrganization();
  const { devis, tableAbsente } = await listerDevis(org.organization_id);
  const modifiable = can(org.role, "leads:manage");

  const aTraiter = devis.filter((d) => d.status === "BROUILLON");
  const enAttente = devis.filter((d) => d.status === "ENVOYE");
  const classes = devis.filter(
    (d) => !["BROUILLON", "ENVOYE"].includes(d.status),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>Devis</SectionTitle>
        {modifiable ? <BoutonNouveauDevis /> : null}
      </div>

      {tableAbsente ? (
        <Sheet tone="urgent">
          <p className="font-medium">La base n’est pas à jour.</p>
          <p className="mt-2 text-sm leading-relaxed">
            La table des devis n’existe pas encore. Appliquez la migration{" "}
            <code className="rounded bg-ink-tint px-1.5 py-0.5">
              0039_devis
            </code>{" "}
            dans l’éditeur SQL de Supabase, puis rechargez cette page.
          </p>
        </Sheet>
      ) : null}

      {!tableAbsente && devis.length === 0 ? (
        <Sheet tone="neutral">
          <p className="font-medium">Aucun devis pour l’instant.</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Quand Zeli reçoit une demande de devis au téléphone, elle crée le
            prospect avec le nom, l’adresse et le problème. Vous repartez de là
            plutôt que d’une feuille blanche.
          </p>
        </Sheet>
      ) : null}

      {[
        { titre: "À finir", liste: aTraiter },
        { titre: "En attente de réponse", liste: enAttente },
        { titre: "Classés", liste: classes },
      ]
        .filter((groupe) => groupe.liste.length > 0)
        .map((groupe) => (
          <section key={groupe.titre}>
            <p className="mb-2 text-sm font-semibold text-ink-soft">
              {groupe.titre}
            </p>
            <ul className="flex flex-col gap-2">
              {groupe.liste.map((d) => {
                const etat = ETATS_DEVIS[d.status];
                return (
                  <li key={d.id}>
                    <Link href={`/app/devis/${d.id}`} className="block">
                      <Sheet
                        interactive
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {d.reference ? `${d.reference} · ` : ""}
                            {d.title}
                          </p>
                          <p className="truncate text-sm text-ink-soft">
                            {d.contact?.display_name ??
                              d.customer_name ??
                              "Sans client rattaché"}
                            {d.valid_until
                              ? ` · valable jusqu’au ${new Date(d.valid_until).toLocaleDateString("fr-BE")}`
                              : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-display font-semibold tabular-nums">
                            {euros(d.total_incl_cents)}
                          </p>
                          <span
                            className={`mt-1 inline-block rounded-pill px-2 py-0.5 text-xs font-semibold ${TONS[etat.ton]}`}
                          >
                            {etat.libelle}
                          </span>
                        </div>
                      </Sheet>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

      <Sheet tone="neutral">
        <p className="text-sm font-medium">Ce que les devis ne font pas</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Zelicall ne produit pas de factures, et n’en produira pas. Depuis le 1
          <sup>er</sup> janvier 2026, une entreprise assujettie à la TVA en
          Belgique doit émettre des factures électroniques structurées pour ses
          clients professionnels — un autre métier que celui-ci.
        </p>
      </Sheet>
    </div>
  );
}
