import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import {
  contactsPourDevis,
  lireDevis,
  servicesPourDevis,
} from "@/lib/quotes/queries";
import {
  ETATS_DEVIS,
  euros,
  modifiable as peutModifier,
  totaux,
} from "@/lib/quotes/totals";
import { EditeurLignes, ActionsDevis } from "./editor";
import { FormulaireClient } from "./client-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Devis — Zelicall" };

const TONS: Record<string, string> = {
  neutre: "bg-ink-tint text-ink-soft",
  signal: "bg-signal-soft text-signal",
  attention: "bg-attention-soft text-attention",
  urgent: "bg-urgent-soft text-urgent",
};

export default async function FicheDevis({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { activeOrganization: org } = await requireOrganization();

  const { devis, erreur } = await lireDevis(id);

  // Un devis absent est un 404. Une lecture qui échoue ne l'est pas : le devis
  // existe, et dire « cette page n'existe pas » enverrait l'artisan chercher
  // une faute qui n'est pas la sienne.
  if (!devis && !erreur) notFound();
  if (!devis) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/app/devis" className="text-sm text-ink-soft">
          ← Tous les devis
        </Link>
        <Sheet>
          <p role="alert" className="text-sm leading-relaxed">
            {erreur}
          </p>
        </Sheet>
      </div>
    );
  }

  const [services, contacts] = await Promise.all([
    servicesPourDevis(org.organization_id),
    contactsPourDevis(org.organization_id),
  ]);
  const ouvert = peutModifier(devis.status) && can(org.role, "leads:manage");
  const etat = ETATS_DEVIS[devis.status];

  // Recalculé ici pour afficher le détail par taux. Les totaux stockés, eux,
  // viennent de la base : si les deux divergeaient, c'est un bogue, et le
  // bandeau ci-dessous le dirait au lieu de le cacher.
  const calcul = totaux(devis.lignes);
  const ecart = calcul.ttc !== devis.total_incl_cents;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/app/devis"
          className="text-sm text-ink-soft hover:text-ink"
        >
          ← Tous les devis
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>
            {devis.reference ? `${devis.reference} · ` : ""}
            {devis.title}
          </SectionTitle>
          <span
            className={`rounded-pill px-3 py-1 text-sm font-semibold ${TONS[etat.ton]}`}
          >
            {etat.libelle}
          </span>
        </div>
      </div>

      {ecart ? (
        <p
          role="alert"
          className="rounded-control bg-urgent-soft px-3 py-2.5 text-sm leading-relaxed"
        >
          Les totaux enregistrés ne correspondent pas à la somme des lignes.
          C’est une anomalie : ne transmettez pas ce devis, et signalez-le.
        </p>
      ) : null}

      <Sheet>
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">
            {devis.contact?.display_name ??
              devis.customer_name ??
              (ouvert
                ? "Pas encore de client — renseignez-le ci-dessous"
                : "Sans client rattaché")}
          </p>
          {devis.customer_address ? (
            <p className="text-ink-soft">{devis.customer_address}</p>
          ) : null}
          {devis.valid_until ? (
            <p className="text-ink-soft">
              Valable jusqu’au{" "}
              {new Date(devis.valid_until).toLocaleDateString("fr-BE")}
            </p>
          ) : null}
          {devis.call_id ? (
            <Link
              href={`/app/appels/${devis.call_id}`}
              className="text-signal underline underline-offset-4"
            >
              Écouter l’appel d’origine
            </Link>
          ) : null}
        </div>
      </Sheet>

      <FormulaireClient
        devisId={devis.id}
        titre={devis.title}
        contactId={devis.contact?.id ?? null}
        nom={devis.customer_name}
        adresse={devis.customer_address}
        contacts={contacts}
        ouvert={ouvert}
      />

      <EditeurLignes
        devisId={devis.id}
        lignes={devis.lignes}
        services={services}
        ouvert={ouvert}
      />

      <Sheet>
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Total hors TVA</dt>
            <dd className="tabular-nums">{euros(devis.total_excl_cents)}</dd>
          </div>
          {calcul.parTaux.map((taux) => (
            <div key={taux.taux} className="flex justify-between">
              <dt className="text-ink-soft">
                TVA {taux.taux} % sur {euros(taux.base)}
              </dt>
              <dd className="tabular-nums">{euros(taux.tva)}</dd>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-line pt-2 text-base font-semibold">
            <dt>Total à payer</dt>
            <dd className="tabular-nums">{euros(devis.total_incl_cents)}</dd>
          </div>
        </dl>
      </Sheet>

      <ActionsDevis
        devisId={devis.id}
        etat={devis.status}
        total={devis.total_incl_cents}
        autorise={can(org.role, "leads:manage")}
      />

      {devis.decline_reason ? (
        <Sheet tone="neutral">
          <p className="text-sm font-medium">Raison du refus</p>
          <p className="mt-1 text-sm text-ink-soft">{devis.decline_reason}</p>
        </Sheet>
      ) : null}
    </div>
  );
}
