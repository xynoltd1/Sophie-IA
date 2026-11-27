import type { Metadata } from "next";
import { ACompleter, PageLegale, Partie } from "@/components/public/legal";
import { metadonneesLegales } from "@/lib/seo/legal";

export const revalidate = 60;
export async function generateMetadata(): Promise<Metadata> {
  return metadonneesLegales("/cgu", "Conditions générales d’utilisation");
}

export default function Cgu() {
  return (
    <PageLegale
      titre="Conditions générales d’utilisation"
      mise_a_jour="6 novembre 2026"
    >
      <Partie titre="Objet">
        <p>
          Ces conditions régissent l’accès au service et son utilisation. Elles
          s’appliquent à toute personne qui crée un compte.
        </p>
      </Partie>

      <Partie titre="Le service">
        <p>
          Zeli répond aux appels entrants d’un professionnel, qualifie la
          demande, consulte les disponibilités d’un agenda connecté, prépare un
          rendez-vous provisoire et centralise les informations.
        </p>
        <p>
          Le rendez-vous reste provisoire tant que le professionnel ne l’a pas
          accepté, lorsque la validation manuelle est active.
        </p>
      </Partie>

      <Partie titre="Ce que le professionnel s’engage à faire">
        <p>
          Donner des informations exactes sur son entreprise, ses services et
          ses tarifs : Zeli ne dit que ce qui lui a été écrit.
        </p>
        <p>
          Vérifier, avant d’activer l’enregistrement des appels, que cette
          activation est licite dans son pays et pour son usage.
        </p>
        <p>
          Informer ses propres clients du traitement de leurs données, et
          répondre à leurs demandes d’exercice de droits.
        </p>
        <p>
          Ne pas utiliser le service pour du démarchage non sollicité, ni pour
          une activité illicite.
        </p>
      </Partie>

      <Partie titre="Ce que l’éditeur ne garantit pas">
        <p>
          Le service dépend de prestataires extérieurs — téléphonie,
          reconnaissance vocale, agenda, envoi de SMS. Une panne chez l’un d’eux
          peut interrompre une partie du service.
        </p>
        <p>
          Zeli peut mal comprendre une demande. Les enregistrements, les
          transcriptions et les résumés sont fournis pour permettre au
          professionnel de vérifier, et cette vérification lui incombe.
        </p>
        <p>
          Zeli ne donne pas de conseil technique et ne se substitue pas au
          jugement du professionnel, en particulier sur une situation
          dangereuse.
        </p>
      </Partie>

      <Partie titre="Disponibilité et interruptions">
        <p>
          Le service peut être interrompu pour maintenance. Aucun engagement
          chiffré de disponibilité n’est pris : le service repose sur des
          opérateurs téléphoniques et des fournisseurs d’intelligence
          artificielle que l’éditeur ne contrôle pas, et promettre un
          pourcentage qui dépend d’eux n’aurait pas de valeur.
        </p>
        <p>
          L’éditeur s’engage en revanche à annoncer à l’avance les
          interruptions prévues lorsque c’est possible, et à traiter sans délai
          celles qui ne le sont pas.
        </p>
        <p>
          Si l’assistante téléphonique est indisponible, les appels suivent le
          comportement de secours réglé par le professionnel dans son compte :
          renvoi vers son propre numéro, ou message d’attente. Un appel n’est
          jamais perdu silencieusement.
        </p>
      </Partie>

      <Partie titre="Suspension et résiliation">
        <p>
          Le professionnel peut supprimer son compte à tout moment.
        </p>
        <p>
          L’éditeur peut suspendre un compte sans préavis en cas d’usage
          illicite, de tentative d’atteinte à la sécurité du service, ou
          d’utilisation manifestement destinée à nuire à des tiers.
        </p>
        <p>
          En cas d’impayé, l’éditeur envoie un rappel par courrier
          électronique. La suspension ne peut intervenir que quinze jours après
          ce rappel resté sans effet.
        </p>
        <p>
          Une suspension n’est pas une suppression : les données restent
          conservées trente jours, et le compte est rétabli dès que la cause de
          la suspension a disparu.
        </p>
      </Partie>

      <Partie titre="Responsabilité">
        <p>
          <ACompleter quoi="clause de limitation de responsabilité, à rédiger par un juriste" />
        </p>
        <p>
          Cette clause est celle qui expose le plus l’éditeur. Elle ne doit pas
          être recopiée d’un autre site : sa validité dépend du droit applicable
          et de la qualité des parties.
        </p>
      </Partie>

      <Partie titre="Droit applicable">
        <p>
          Les présentes conditions sont soumises au droit belge. Les tribunaux
          de l’arrondissement du siège de l’éditeur sont compétents — tribunal
          de l’entreprise d’Anvers, division Tongeren — sans préjudice des
          règles impératives protégeant le client dans son propre pays. Cette
          clause doit être confirmée par un juriste avant publication.
        </p>
      </Partie>
    </PageLegale>
  );
}
