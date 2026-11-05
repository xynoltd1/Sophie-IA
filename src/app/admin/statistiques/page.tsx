import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { Carte, Chiffre, TitreSection } from "@/components/admin/surface";
import { Courbe, Histogramme } from "@/components/admin/chart";
import { Chip } from "@/components/ui/chip";
import {
  LIBELLES_USAGE,
  PERIODES,
  consommationTotale,
  dureeLisible,
  part,
  periodeDepuis,
  serieQuotidienne,
  statsPlateforme,
} from "@/lib/platform/stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Statistiques — Plateforme" };

/**
 * Statistiques détaillées.
 *
 * Trois familles, séparées parce qu'elles ne se lisent pas au même moment :
 * le commercial se regarde une fois par semaine, l'opérationnel tous les
 * jours, les coûts quand on décide un prix.
 *
 * Les dates sont des journées entières dans le fuseau du serveur de base de
 * données, et non des fenêtres glissantes de 24 heures : « 7 jours » veut dire
 * sept journées de calendrier. Un appel de 23 h 50 appartient à sa journée.
 */
export default async function StatistiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  await requirePlatformAdmin();
  const { periode: brut } = await searchParams;
  const periode = periodeDepuis(brut);

  const [{ stats }, serie, consommation] = await Promise.all([
    statsPlateforme(periode.jours),
    serieQuotidienne(periode.jours),
    consommationTotale(new Date(Date.now() - periode.jours * 86_400_000)),
  ]);

  const activation = part(
    stats.organizations_activated,
    stats.organizations_new,
  );
  const confirmation = part(
    stats.appointments_confirmed,
    stats.appointments_created,
  );
  const reussiteSms = part(
    stats.messages_sent,
    stats.messages_sent + stats.messages_failed,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Statistiques
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODES.map((p) => (
            <Chip
              key={p.cle}
              href={`/admin/statistiques?periode=${p.cle}`}
              actif={p.cle === periode.cle}
            >
              {p.libelle}
            </Chip>
          ))}
          <Link
            href={`/admin/statistiques/export?periode=${periode.cle}`}
            className="flex min-h-11 items-center rounded-control border border-line bg-surface px-3 text-sm font-medium"
          >
            Exporter en CSV
          </Link>
        </div>
      </div>

      <section>
        <TitreSection detail="Les entreprises, de l’inscription à l’abonnement.">
          Commercial
        </TitreSection>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Chiffre
            libelle="Entreprises inscrites"
            valeur={stats.organizations_total}
          />
          <Chiffre
            libelle="Nouvelles sur la période"
            valeur={stats.organizations_new}
          />
          <Chiffre
            libelle="Taux d’activation"
            valeur={activation === null ? "—" : `${activation} %`}
            detail={
              activation === null
                ? "aucune inscription sur la période"
                : "configuration terminée"
            }
          />
          <Chiffre
            libelle="Abonnements actifs"
            valeur={stats.subscriptions_active}
          />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Chiffre
            libelle="Revenu mensuel récurrent"
            indisponible="Aucun paiement n’est branché et aucun prix n’est fixé (section 38)."
          />
          <Chiffre
            libelle="Désabonnements"
            indisponible="Demande un historique d’abonnements payants, qui n’existe pas encore."
          />
          <Chiffre
            libelle="Rétention"
            indisponible="Demande plusieurs mois d’abonnements réels."
          />
        </div>

        <Carte className="mt-3">
          <p className="mb-2 text-sm font-medium">
            Nouvelles entreprises par jour
          </p>
          <Courbe
            titre="Nouvelles entreprises par jour"
            points={serie.map((j) => ({
              label: j.jour,
              valeur: j.organizations_new,
            }))}
          />
        </Carte>
      </section>

      <section>
        <TitreSection detail="Ce que Sophie a réellement fait, hors essais.">
          Opérationnel
        </TitreSection>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Chiffre libelle="Appels reçus" valeur={stats.calls_total} />
          <Chiffre libelle="Appels aboutis" valeur={stats.calls_completed} />
          <Chiffre libelle="Manqués ou en échec" valeur={stats.calls_failed} />
          <Chiffre
            libelle="Durée moyenne"
            valeur={
              stats.calls_total > 0
                ? dureeLisible(
                    Math.round(
                      stats.calls_duration_seconds / stats.calls_total,
                    ),
                  )
                : "—"
            }
          />
          <Chiffre libelle="Prospects générés" valeur={stats.leads_created} />
          <Chiffre libelle="Urgences détectées" valeur={stats.urgent_leads} />
          <Chiffre
            libelle="Rendez-vous confirmés"
            valeur={confirmation === null ? "—" : `${confirmation} %`}
            detail={`${stats.appointments_confirmed} sur ${stats.appointments_created}`}
          />
          <Chiffre
            libelle="SMS partis"
            valeur={reussiteSms === null ? "—" : `${reussiteSms} %`}
            detail={`${stats.messages_failed} en échec`}
          />
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Carte>
            <p className="mb-2 text-sm font-medium">
              Appels et échecs par jour
            </p>
            <Courbe
              titre="Appels par jour"
              points={serie.map((j) => ({ label: j.jour, valeur: j.calls }))}
            />
            <p className="mb-2 mt-4 text-sm font-medium text-ink-soft">
              Échecs
            </p>
            <Courbe
              titre="Appels en échec par jour"
              points={serie.map((j) => ({
                label: j.jour,
                valeur: j.calls_failed,
              }))}
            />
          </Carte>
          <Carte>
            <p className="mb-2 text-sm font-medium">
              Prospects et rendez-vous par jour
            </p>
            <Courbe
              titre="Prospects par jour"
              points={serie.map((j) => ({ label: j.jour, valeur: j.leads }))}
            />
            <p className="mb-2 mt-4 text-sm font-medium text-ink-soft">
              Rendez-vous
            </p>
            <Courbe
              titre="Rendez-vous par jour"
              points={serie.map((j) => ({
                label: j.jour,
                valeur: j.appointments,
              }))}
            />
          </Carte>
        </div>
      </section>

      <section>
        <TitreSection detail="Ce que la plateforme a consommé. Les tarifs, eux, ne sont pas dans le produit.">
          Consommation et coûts
        </TitreSection>

        {consommation.length === 0 ? (
          <Carte>
            <p className="text-sm text-ink-soft">
              Rien de consommé sur la période. La consommation se remplit quand
              de vrais appels arrivent et que de vrais SMS partent.
            </p>
          </Carte>
        ) : (
          <Carte>
            <Histogramme
              titre="Consommation par nature"
              points={consommation.map((ligne) => ({
                label: LIBELLES_USAGE[ligne.kind]?.nom ?? ligne.kind,
                valeur: Math.round(ligne.total),
              }))}
            />
          </Carte>
        )}

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Chiffre
            libelle="Coût téléphonie et voix"
            indisponible="Le produit ne connaît pas les tarifs des fournisseurs. Les saisir est une décision commerciale."
          />
          <Chiffre
            libelle="Coût par minute"
            indisponible="Dépend des tarifs ci-contre."
          />
          <Chiffre
            libelle="Marge brute"
            indisponible="Demande des revenus et des coûts réels. Aucun des deux n’existe."
          />
        </div>
      </section>
    </div>
  );
}
