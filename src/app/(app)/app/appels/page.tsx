import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { SectionTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { can } from "@/lib/auth/permissions";
import {
  FILTRES,
  PERIODES,
  bornesAffichees,
  listerAppels,
  type FiltreAppels,
  type Periode,
} from "@/lib/crm/calls-query";
import { Chip } from "@/components/ui/chip";
import { ListeAppels } from "./liste-appels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appels — Zelicall" };

/**
 * La liste des appels.
 *
 * Paginée en base, parce qu'une liste qui charge tout finit par ne plus
 * charger du tout, et parce que le filtre « sans suite » ne peut pas se
 * calculer sur une page partielle.
 *
 * Dix par page par défaut : l'application se lit d'abord sur un téléphone, et
 * dix cartes remplissent déjà un écran. Qui veut plus le choisit.
 *
 * Tous les filtres vivent dans l'adresse : une recherche peut être partagée,
 * mise en favori, et le bouton Retour fait ce qu'on attend.
 */
const TAILLES = [10, 20, 50];

export default async function AppelsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    filtre?: string;
    periode?: string;
    page?: string;
    taille?: string;
    corbeille?: string;
  }>;
}) {
  const params = await searchParams;
  const { activeOrganization } = await requireOrganization();

  const filtre = (FILTRES.find((f) => f.cle === params.filtre)?.cle ??
    "TOUS") as FiltreAppels;
  const periode = (PERIODES.find((p) => p.cle === params.periode)?.cle ??
    "TOUT") as Periode;
  const taille = TAILLES.includes(Number(params.taille))
    ? Number(params.taille)
    : 10;
  const corbeille = params.corbeille === "1";
  const terme = (params.q ?? "").slice(0, 80);

  const resultat = await listerAppels({
    organizationId: activeOrganization.organization_id,
    terme,
    filtre,
    periode,
    corbeille,
    page: Number(params.page) || 1,
    taille,
  });

  const { debut, fin } = bornesAffichees(resultat);

  /** Conserve les filtres en changeant un seul paramètre. */
  const lien = (modifs: Record<string, string | number | undefined>) => {
    const url = new URLSearchParams();
    if (terme) url.set("q", terme);
    if (filtre !== "TOUS") url.set("filtre", filtre);
    if (periode !== "TOUT") url.set("periode", periode);
    if (taille !== 10) url.set("taille", String(taille));
    if (corbeille) url.set("corbeille", "1");

    for (const [cle, valeur] of Object.entries(modifs)) {
      if (valeur === undefined || valeur === "") url.delete(cle);
      else url.set(cle, String(valeur));
    }

    const chaine = url.toString();
    return chaine ? `/app/appels?${chaine}` : "/app/appels";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <SectionTitle>{corbeille ? "Corbeille" : "Appels"}</SectionTitle>
        <Link
          href={lien({ corbeille: corbeille ? undefined : "1", page: 1 })}
          className="text-sm text-ink-soft underline underline-offset-4"
        >
          {corbeille ? "Retour aux appels" : "Corbeille"}
        </Link>
      </div>

      {/* Un seul bloc de contrôles. L'écran empilait la recherche, les
          filtres, les périodes et un lien de corbeille : quatre rangées avant
          le premier appel, c'est-à-dire aucun appel visible sur un téléphone.
          La période est devenue une liste déroulante — natale sur mobile, donc
          plus confortable qu'une rangée de puces — et partage le bouton. */}
      <form action="/app/appels" method="get" className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={terme}
            placeholder="Nom, entreprise ou numéro"
            aria-label="Rechercher un appel"
            className="min-h-12 min-w-0 flex-1 rounded-control border border-line bg-surface px-3"
          />
          <button
            type="submit"
            className="min-h-12 shrink-0 rounded-control bg-signal px-4 text-sm font-medium text-white"
          >
            Chercher
          </button>
        </div>
        <select
          name="periode"
          defaultValue={periode}
          aria-label="Période"
          className="min-h-12 w-full rounded-control border border-line bg-surface px-3 text-sm"
        >
          {PERIODES.map((p) => (
            <option key={p.cle} value={p.cle}>
              {p.libelle}
            </option>
          ))}
        </select>
        {filtre !== "TOUS" ? (
          <input type="hidden" name="filtre" value={filtre} />
        ) : null}
        {taille !== 10 ? (
          <input type="hidden" name="taille" value={taille} />
        ) : null}
        {corbeille ? <input type="hidden" name="corbeille" value="1" /> : null}
      </form>

      <nav
        aria-label="Filtrer les appels"
        className="-mx-4 flex gap-2 overflow-x-auto px-4"
      >
        {FILTRES.map((f) => (
          <Chip
            key={f.cle}
            href={lien({
              filtre: f.cle === "TOUS" ? undefined : f.cle,
              page: 1,
            })}
            actif={filtre === f.cle}
          >
            {f.libelle}
          </Chip>
        ))}
      </nav>

      {resultat.erreur ? (
        <ErrorState description="Vos appels n’ont pas pu être chargés. Rechargez la page." />
      ) : resultat.appels.length === 0 ? (
        <EmptyState
          title={
            terme
              ? "Aucun appel ne correspond"
              : corbeille
                ? "La corbeille est vide"
                : filtre === "TOUS"
                  ? "Aucun appel pour le moment"
                  : "Aucun appel dans ce filtre"
          }
          description={
            terme
              ? "Essayez un autre nom ou un autre numéro."
              : corbeille
                ? "Les appels supprimés restent ici 30 jours avant d’être effacés définitivement."
                : "Chaque appel reçu par Zeli apparaîtra ici, avec son enregistrement, son résumé et sa transcription."
          }
          action={
            terme || filtre !== "TOUS" || periode !== "TOUT" ? (
              <Link
                href="/app/appels"
                className="font-medium text-signal underline underline-offset-4"
              >
                Voir tous les appels
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            Affichage de {debut} à {fin} sur {resultat.total} appel
            {resultat.total > 1 ? "s" : ""}
          </p>

          <ListeAppels
            appels={resultat.appels}
            peutSupprimer={can(activeOrganization.role, "organization:update")}
            corbeille={corbeille}
          />

          {resultat.pages > 1 ? (
            <nav
              aria-label="Pages"
              className="flex items-center justify-between gap-3"
            >
              {resultat.page > 1 ? (
                <Link
                  href={lien({ page: resultat.page - 1 })}
                  className="flex min-h-12 items-center rounded-control border border-line bg-surface px-4 text-sm font-medium"
                >
                  Précédent
                </Link>
              ) : (
                <span className="text-sm text-ink-faint">Précédent</span>
              )}

              <span className="text-sm text-ink-soft">
                Page {resultat.page} sur {resultat.pages}
              </span>

              {resultat.page < resultat.pages ? (
                <Link
                  href={lien({ page: resultat.page + 1 })}
                  className="flex min-h-12 items-center rounded-control border border-line bg-surface px-4 text-sm font-medium"
                >
                  Suivant
                </Link>
              ) : (
                <span className="text-sm text-ink-faint">Suivant</span>
              )}
            </nav>
          ) : null}

          {/* Un réglage rare ne mérite pas une carte : trois liens discrets
              suffisent, et la page se termine sur les appels. */}
          <p className="flex items-center justify-center gap-3 text-sm text-ink-soft">
            Par page
            {TAILLES.map((valeur) => (
              <Link
                key={valeur}
                href={lien({ taille: valeur, page: 1 })}
                aria-current={taille === valeur ? "true" : undefined}
                className={
                  taille === valeur
                    ? "tabular font-semibold text-ink underline underline-offset-4"
                    : "tabular underline underline-offset-4"
                }
              >
                {valeur}
              </Link>
            ))}
          </p>
        </>
      )}
    </div>
  );
}
