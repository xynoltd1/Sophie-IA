import type { Metadata } from "next";
import { ACompleter, PageLegale, Partie } from "@/components/public/legal";
import { metadonneesLegales } from "@/lib/seo/legal";

export const revalidate = 60;
export async function generateMetadata(): Promise<Metadata> {
  return metadonneesLegales("/confidentialite", "Politique de confidentialité");
}

export default function Confidentialite() {
  return (
    <PageLegale
      titre="Politique de confidentialité"
      mise_a_jour="6 novembre 2026"
    >
      <Partie titre="Qui traite vos données">
        <p>
          Responsable du traitement : <ACompleter quoi="raison sociale" />,{" "}
          <ACompleter quoi="adresse" />,{" "}
          <ACompleter quoi="numéro d’entreprise" />.
        </p>
        <p>
          Contact pour les questions de protection des données :{" "}
          <ACompleter quoi="adresse e-mail" />.
        </p>
      </Partie>

      <Partie titre="Deux rôles bien distincts">
        <p>
          Pour les données de <strong>l’artisan abonné</strong> — son compte,
          son entreprise, sa facturation — l’éditeur est responsable du
          traitement.
        </p>
        <p>
          Pour les données des <strong>clients de l’artisan</strong> — leur
          numéro, leur nom, l’enregistrement de leur appel — l’artisan est
          responsable du traitement, et l’éditeur est sous-traitant au sens de
          l’article 28 du RGPD. Un contrat de sous-traitance doit être conclu
          entre les deux.{" "}
          <ACompleter quoi="référence du contrat de sous-traitance" />
        </p>
      </Partie>

      <Partie titre="Ce qui est collecté">
        <p>
          <strong>Compte et entreprise</strong> : nom, adresse e-mail, nom
          commercial, métier, adresse, zone d’intervention, horaires.
        </p>
        <p>
          <strong>Appels</strong> : numéro de l’appelant, date, durée, issue de
          l’appel. Si l’artisan a activé l’enregistrement : l’audio, sa
          transcription et son résumé.
        </p>
        <p>
          <strong>Contacts et rendez-vous</strong> : ce que l’appelant indique
          lui-même pendant l’appel — nom, adresse d’intervention, nature du
          problème.
        </p>
        <p>
          <strong>Mesure d’audience du site</strong> : chemin de la page,
          provenance, largeur d’écran. Sans cookie, sans identifiant
          publicitaire, sans adresse IP conservée en clair.
        </p>
      </Partie>

      <Partie titre="L’enregistrement des appels">
        <p>
          Il est <strong>désactivé par défaut</strong>. L’artisan doit l’activer
          lui-même et accepter une politique d’enregistrement.
        </p>
        <p>
          Quand il est actif, l’appelant en est informé au début de l’appel. La
          durée de conservation est réglable et plafonnée à trente jours.
          L’audio est stocké dans un espace privé ; son accès passe par une
          adresse temporaire délivrée après vérification des droits.
        </p>
        <p>
          Les règles applicables à l’enregistrement d’une conversation
          téléphonique diffèrent selon le pays et selon la base légale retenue.{" "}
          <ACompleter quoi="base légale retenue, par pays" /> Cette question
          doit être tranchée par un juriste avant toute mise en service auprès
          de vrais appelants.
        </p>
      </Partie>

      <Partie titre="Combien de temps">
        <p>
          Audio des appels : au maximum trente jours, réglable par l’artisan.
        </p>
        <p>
          Transcriptions, résumés, fiches de contact et rendez-vous :{" "}
          <ACompleter quoi="durée de conservation retenue" />
        </p>
        <p>
          Mesure d’audience :{" "}
          <ACompleter quoi="durée de conservation retenue" />
        </p>
        <p>
          Compte : jusqu’à sa suppression par l’artisan, puis{" "}
          <ACompleter quoi="délai de purge" />
        </p>
      </Partie>

      <Partie titre="Qui d’autre y a accès">
        <p>
          Des prestataires techniques interviennent nécessairement :
          hébergement, base de données, téléphonie, synthèse et reconnaissance
          vocale, transcription, envoi de SMS, agenda.
        </p>
        <p>
          La liste nominative, les pays d’hébergement et les garanties de
          transfert hors Union européenne doivent figurer ici.{" "}
          <ACompleter quoi="liste des sous-traitants, pays, garanties" />
        </p>
        <p>
          L’éditeur n’accède pas aux enregistrements audio des appels des
          clients : aucune autorisation de la plateforme ne l’y donne droit.
        </p>
      </Partie>

      <Partie titre="Vos droits">
        <p>
          Accès, rectification, effacement, limitation, opposition et
          portabilité. Pour les exercer, écrire à{" "}
          <ACompleter quoi="adresse e-mail" />.
        </p>
        <p>
          Une réclamation peut être déposée auprès de l’Autorité de protection
          des données (Belgique) ou de la CNIL (France).
        </p>
        <p>
          Si vous avez appelé une entreprise utilisant Sophie et souhaitez
          exercer vos droits sur cet appel, adressez-vous d’abord à cette
          entreprise : c’est elle qui décide de ce qui est conservé.
        </p>
      </Partie>

      <Partie titre="Intelligence artificielle">
        <p>
          Sophie est un système automatisé. Elle l’annonce au début de chaque
          appel, et ce réglage n’est pas désactivable.
        </p>
        <p>
          Elle ne prend pas de décision produisant des effets juridiques :
          chaque rendez-vous reste provisoire tant que l’artisan ne l’a pas
          accepté, lorsque la validation manuelle est active.
        </p>
      </Partie>
    </PageLegale>
  );
}
