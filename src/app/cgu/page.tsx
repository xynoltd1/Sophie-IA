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
          Sophie répond aux appels entrants d’un professionnel, qualifie la
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
          ses tarifs : Sophie ne dit que ce qui lui a été écrit.
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
          Sophie peut mal comprendre une demande. Les enregistrements, les
          transcriptions et les résumés sont fournis pour permettre au
          professionnel de vérifier, et cette vérification lui incombe.
        </p>
        <p>
          Sophie ne donne pas de conseil technique et ne se substitue pas au
          jugement du professionnel, en particulier sur une situation
          dangereuse.
        </p>
      </Partie>

      <Partie titre="Disponibilité et interruptions">
        <p>
          Le service peut être interrompu pour maintenance. Aucun engagement de
          disponibilité chiffré n’est pris à ce stade.{" "}
          <ACompleter quoi="engagement de disponibilité, si l’éditeur en prend un" />
        </p>
      </Partie>

      <Partie titre="Suspension et résiliation">
        <p>
          Le professionnel peut supprimer son compte à tout moment. L’éditeur
          peut suspendre un compte en cas d’usage illicite ou d’impayé, après{" "}
          <ACompleter quoi="délai de préavis" />.
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
          <ACompleter quoi="droit applicable et juridiction compétente" />
        </p>
      </Partie>
    </PageLegale>
  );
}
