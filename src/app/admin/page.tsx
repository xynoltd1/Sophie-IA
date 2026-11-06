import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { Carte, Chiffre, TitreSection } from "@/components/admin/surface";
import { Courbe } from "@/components/admin/chart";
import { ErrorState } from "@/components/ui/states";
import {
  PERIODES,
  dureeLisible,
  part,
  periodeDepuis,
  serieQuotidienne,
  statsPlateforme,
} from "@/lib/platform/stats";
import { Chip } from "@/components/ui/chip";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vue d’ensemble — Plateforme" };

/**
 * Tableau de bord de pilotage.
 *
 * ## Ce qui n'est pas affiché, et pourquoi c'est écrit
 *
 * Le chiffre d'affaires, le coût par minute et la marge n'apparaissent pas :
 * aucun paiement n'est branché, et le produit ne connaît ni le tarif du
 * fournisseur de voix, ni celui du modèle, ni celui de l'opérateur. Les
 * estimer donnerait une marge fausse, et une marge fausse oriente une décision
 * de prix — c'est le pire endroit où mettre un chiffre inventé.
 *
 * Ces cases disent donc « Non disponible » avec la raison, plutôt que zéro.
 */
export default async function AdminAccueil({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  await requirePlatformAdmin();
  const { periode: brut } = await searchParams;
  const periode = periodeDepuis(brut);

  const [{ stats, erreur }, serie] = await Promise.all([
    statsPlateforme(periode.jours),
    serieQuotidienne(periode.jours),
  ]);

  if (erreur) {
    return (
      <ErrorState description="Les statistiques n’ont pas pu être chargées. Les migrations 0033 sont-elles appliquées ?" />
    );
  }

  const reussite = part(stats.calls_completed, stats.calls_total);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Vue d’ensemble
        </h1>
        <nav aria-label="Période" className="flex gap-2">
          {PERIODES.map((p) => (
            <Chip
              key={p.cle}
              href={`/admin?periode=${p.cle}`}
              actif={p.cle === periode.cle}
            >
              {p.libelle}
            </Chip>
          ))}
        </nav>
      </div>

      <section>
        <TitreSection detail="Les entreprises inscrites sur la plateforme.">
          Clients
        </TitreSection>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Chiffre libelle="Entreprises" valeur={stats.organizations_total} />
          <Chiffre
            libelle="Nouvelles"
            valeur={stats.organizations_new}
            detail={`sur ${periode.jours} jours`}
          />
          <Chiffre
            libelle="Configurations terminées"
            valeur={stats.organizations_activated}
            detail={`sur ${periode.jours} jours`}
          />
          <Chiffre
            libelle="Abonnements actifs"
            valeur={stats.subscriptions_active}
            detail="aucun paiement branché"
          />
        </div>
      </section>

      <section>
        <TitreSection detail="Hors appels d’essai : ils gonfleraient chaque chiffre sans qu’aucun client n’ait appelé.">
          Activité de Zeli
        </TitreSection>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Chiffre libelle="Appels reçus" valeur={stats.calls_total} />
          <Chiffre
            libelle="Appels aboutis"
            valeur={reussite === null ? "—" : `${reussite} %`}
            detail={
              reussite === null
                ? "aucun appel sur la période"
                : `${stats.calls_completed} sur ${stats.calls_total}`
            }
          />
          <Chiffre
            libelle="Temps au téléphone"
            valeur={dureeLisible(stats.calls_duration_seconds)}
          />
          <Chiffre
            libelle="Appels manqués ou en échec"
            valeur={stats.calls_failed}
          />
        </div>

        <Carte className="mt-3">
          <p className="mb-2 text-sm font-medium">Appels par jour</p>
          <Courbe
            titre="Appels par jour"
            points={serie.map((j) => ({ label: j.jour, valeur: j.calls }))}
          />
        </Carte>
      </section>

      <section>
        <TitreSection>Ce que les appels ont produit</TitreSection>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Chiffre libelle="Prospects" valeur={stats.leads_created} />
          <Chiffre libelle="Urgences" valeur={stats.urgent_leads} />
          <Chiffre
            libelle="Rendez-vous pris"
            valeur={stats.appointments_created}
            detail={`${stats.appointments_confirmed} confirmés`}
          />
          <Chiffre libelle="Tâches créées" valeur={stats.tasks_created} />
        </div>
      </section>

      <section>
        <TitreSection>Santé</TitreSection>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Chiffre libelle="SMS envoyés" valeur={stats.messages_sent} />
          <Chiffre libelle="SMS en échec" valeur={stats.messages_failed} />
          <Chiffre
            libelle="Erreurs fournisseurs"
            valeur={stats.provider_errors}
          />
          <Chiffre
            libelle="Chiffre d’affaires"
            indisponible="Aucun paiement n’est branché. Voir le plan d’action, étape C4."
          />
        </div>
      </section>

      <section>
        <TitreSection>Coûts et marge</TitreSection>
        <div className="grid gap-3 lg:grid-cols-3">
          <Chiffre
            libelle="Coût fournisseurs"
            indisponible="Les tarifs des fournisseurs ne sont pas dans le produit. Les estimer donnerait un chiffre faux."
          />
          <Chiffre
            libelle="Coût par entreprise"
            indisponible="Dépend du coût fournisseurs, lui-même indisponible."
          />
          <Chiffre
            libelle="Marge brute"
            indisponible="Demande des revenus et des coûts réels. Ni l’un ni l’autre n’existe aujourd’hui."
          />
        </div>
      </section>

      <Carte>
        <p className="font-medium">Ce que cet espace ne donne pas</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Aucun accès aux enregistrements audio des clients, par construction
          (ADR-033). Ce sont les voix de personnes qui n’ont pas consenti à être
          écoutées par un éditeur de logiciel. Une demande judiciaire se traite
          autrement, et se journalise.{" "}
          <Link href="/admin/sante" className="underline underline-offset-4">
            Voir la santé du système
          </Link>
          .
        </p>
      </Carte>
    </div>
  );
}
