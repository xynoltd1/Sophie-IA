import type { Metadata } from "next";
import { ACompleter, PageLegale, Partie } from "@/components/public/legal";
import { metadonneesLegales } from "@/lib/seo/legal";

export const revalidate = 60;
export async function generateMetadata(): Promise<Metadata> {
  return metadonneesLegales("/cgv", "Conditions générales de vente");
}

export default function Cgv() {
  return (
    <PageLegale
      titre="Conditions générales de vente"
      mise_a_jour="6 novembre 2026"
    >
      <Partie titre="Avertissement particulier sur ce document">
        <p>
          Aucun tarif n’est fixé à ce jour, et aucune vente n’a lieu. Ce
          document est une trame : il indique ce qu’il faudra décider, et non ce
          qui est décidé.
        </p>
      </Partie>

      <Partie titre="Offres et prix">
        <p>
          Trois catégories sont prévues — Solo, Pro et Équipe — avec des volumes
          d’appel et de SMS inclus différents.
        </p>
        <p>
          Prix :{" "}
          <ACompleter quoi="montant mensuel par offre, hors taxes et toutes taxes comprises" />
        </p>
        <p>
          Dépassement des volumes inclus :{" "}
          <ACompleter quoi="tarif à la minute et au SMS au-delà du forfait" />
        </p>
      </Partie>

      <Partie titre="Commande, facturation, paiement">
        <p>
          Moyens de paiement acceptés : <ACompleter quoi="moyens de paiement" />
        </p>
        <p>
          Périodicité et date de prélèvement :{" "}
          <ACompleter quoi="mensuel, annuel, date" />
        </p>
        <p>
          Retard de paiement :{" "}
          <ACompleter quoi="intérêts et indemnité forfaitaire applicables" />
        </p>
      </Partie>

      <Partie titre="Durée, reconduction, résiliation">
        <p>
          Durée d’engagement : <ACompleter quoi="durée" />
        </p>
        <p>
          Reconduction : <ACompleter quoi="tacite ou expresse, préavis" />
        </p>
        <p>
          Effet de la résiliation sur les données :{" "}
          <ACompleter quoi="délai d’export et de suppression" />
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
          Contact : <ACompleter quoi="adresse e-mail et postale" />
        </p>
        <p>
          Médiation de la consommation, si elle s’applique :{" "}
          <ACompleter quoi="organisme de médiation" />
        </p>
        <p>
          Droit applicable et juridiction : <ACompleter quoi="à préciser" />
        </p>
      </Partie>
    </PageLegale>
  );
}
