import type { Metadata } from "next";
import { ACompleter, PageLegale, Partie } from "@/components/public/legal";
import { metadonneesLegales } from "@/lib/seo/legal";
import { offresPubliques } from "@/lib/seo/offres";

export const revalidate = 60;
export async function generateMetadata(): Promise<Metadata> {
  return metadonneesLegales("/cgv", "Conditions générales de vente");
}

/**
 * Les conditions de vente.
 *
 * ## Pourquoi les prix ne sont pas écrits ici
 *
 * Ils sont lus dans le catalogue, celui-là même qui alimente la page d'accueil
 * et la console. Un prix recopié dans un document finit toujours par mentir :
 * il est changé à un endroit et oublié à l'autre, et c'est le document
 * contractuel qui reste faux.
 *
 * Tant qu'une offre n'a pas de tarif, la section le dit. Elle n'invente rien.
 *
 * ## D'où viennent les autres valeurs
 *
 * Durée, reconduction, délais, pénalités : ce sont des propositions écrites
 * pour servir de point de départ, pas des décisions arrêtées. Le bandeau en
 * haut de page le dit, et il reste tant qu'un juriste n'a pas relu.
 */
export default async function Cgv() {
  const offres = await offresPubliques();
  return (
    <PageLegale
      titre="Conditions générales de vente"
      mise_a_jour="6 novembre 2026"
    >
      <Partie titre="Avertissement particulier sur ce document">
        <p>
          Les conditions ci-dessous sont une proposition de départ, écrite pour
          être relue et corrigée. Elles n’ont pas été validées par un juriste et
          n’engagent personne en l’état.
        </p>
      </Partie>

      <Partie titre="Offres et prix">
        <p>
          Trois offres : Solo, pour un artisan seul ; Pro, pour un artisan avec
          plus de volume ; Équipe, pour plusieurs intervenants sur un même
          agenda. Elles diffèrent par les minutes d’appel et les SMS inclus
          chaque mois, et par le nombre de personnes autorisées sur le compte.
        </p>

        {offres.length > 0 ? (
          <ul>
            {offres.map((offre) => (
              <li key={offre.code}>
                <strong>{offre.label}</strong> — {offre.prix ?? "tarif à venir"}
                , {offre.minutes} minutes d’appel et {offre.sms} SMS inclus,{" "}
                {offre.membres
                  ? `${offre.membres} personne${offre.membres > 1 ? "s" : ""} sur le compte`
                  : "nombre de personnes non limité"}
                .
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Aucune offre n’est publiée à ce jour. Les tarifs seront affichés ici
            dès qu’ils le seront.
          </p>
        )}

        <p>
          Les montants s’entendent par mois et hors taxes. La taxe sur la valeur
          ajoutée s’ajoute au taux en vigueur, sauf lorsque le client est un
          professionnel assujetti établi dans un autre État membre : la taxe est
          alors due par lui dans son pays, et la facture est émise sans TVA
          belge.
        </p>
        <p>
          Au-delà des volumes inclus, les consommations supplémentaires sont
          facturées 0,35 € hors taxes la minute d’appel et 0,12 € hors taxes
          le SMS. Le compteur du mois est consultable à tout moment dans la
          rubrique « Consommation » du compte.
        </p>
      </Partie>

      <Partie titre="Commande, facturation, paiement">
        <p>
          Moyens de paiement acceptés : carte bancaire et domiciliation
          européenne (SEPA). Le virement est accepté pour l’offre Équipe et
          pour tout paiement annuel.
        </p>
        <p>
          L’abonnement est payable d’avance, par mois. Le premier paiement a
          lieu à la souscription ; les suivants, à la même date chaque mois. Les
          consommations au-delà du forfait sont facturées le mois suivant, avec
          l’abonnement.
        </p>
        <p>
          La facture est envoyée par courrier électronique et reste disponible
          dans le compte.
        </p>
        <p>
          Retard de paiement : <ACompleter quoi="intérêts et indemnité forfaitaire applicables" />{" "}
          Les montants minimaux diffèrent entre la Belgique et la France, et
          cette clause doit être écrite par un juriste.
        </p>
      </Partie>

      <Partie titre="Durée, reconduction, résiliation">
        <p>
          L’abonnement est conclu pour un mois. Il n’y a pas d’engagement de
          durée plus longue.
        </p>
        <p>
          Il se renouvelle ensuite automatiquement de mois en mois. Le client
          peut y mettre fin à tout moment depuis son compte. La résiliation
          prend effet à la fin du mois déjà payé : le service continue jusque-là
          et aucun prélèvement ne suit.
        </p>
        <p>
          Après la fin de l’abonnement, le compte reste accessible en lecture
          pendant trente jours, le temps d’exporter les fiches clients, les
          rendez-vous, les résumés et les enregistrements d’appels. Passé ce
          délai, les données sont supprimées dans les soixante jours, sauf ce
          que la loi oblige à conserver, comme les pièces comptables.
        </p>
        <p>
          Ces données appartiennent au client. L’éditeur ne les conserve pas
          pour s’en servir ailleurs, et ne les vend à personne.
        </p>
      </Partie>

      <Partie titre="Droit de rétractation">
        <p>
          Le service s’adresse à des professionnels agissant dans le cadre de
          leur activité. Le droit de rétractation du consommateur ne s’applique
          donc pas de plein droit, mais des exceptions existent selon la taille
          de l’entreprise et le pays.{" "}
          <ACompleter quoi="position retenue, par pays" />
        </p>
        <p>
          Ce point doit être tranché par un juriste : s’y tromper expose à une
          sanction administrative.
        </p>
      </Partie>

      <Partie titre="Réclamations et litiges">
        <p>
          Contact :{" "}
          <a href="mailto:contact@zelicall.com">contact@zelicall.com</a>, ou
          XYNO, Kuilenstraat 16, 3700 Tongeren, Belgique
        </p>
        <p>
          Médiation de la consommation, si elle s’applique :{" "}
          <ACompleter quoi="organisme de médiation" />
        </p>
        <p>
          Les présentes conditions sont soumises au droit belge. En cas de
          litige entre professionnels, les tribunaux de l’arrondissement du
          siège de l’éditeur sont compétents — tribunal de l’entreprise
          d’Anvers, division Tongeren. Les règles impératives protégeant le
          client dans son propre pays restent réservées. Cette clause doit être
          confirmée par un juriste avant publication.
        </p>
      </Partie>
    </PageLegale>
  );
}
