import type { Metadata } from "next";
import { ACompleter, PageLegale, Partie } from "@/components/public/legal";
import { metadonneesLegales } from "@/lib/seo/legal";

export const revalidate = 60;
export async function generateMetadata(): Promise<Metadata> {
  return metadonneesLegales("/mentions-legales", "Mentions légales");
}

/**
 * Les mentions légales.
 *
 * ## D'où viennent ces informations
 *
 * De deux publications au Moniteur belge : l'acte de constitution du 6 mai
 * 2023, et l'acte du 5 avril 2024 qui nomme la gérante actuelle et fixe le
 * siège. Rien n'est déduit ni arrondi : ce qui n'est pas écrit dans ces actes
 * reste marqué « À COMPLÉTER ».
 *
 * Le numéro d'entreprise porte une clé de contrôle — les deux derniers
 * chiffres valent 97 moins le reste des huit premiers modulo 97. Celui-ci la
 * vérifie, ce qui écarte une erreur de lecture du scan.
 *
 * ## Ce qui manque encore, et pourquoi
 *
 * Le numéro de TVA n'apparaissait dans aucun des deux actes. Il a été confirmé
 * par l'éditrice le 27 novembre 2026 : BE 0801.484.571, soit le numéro
 * d'entreprise précédé de « BE », ce qui est la règle belge pour une société
 * assujettie. Il restait vide jusque-là parce qu'une société non assujettie
 * n'en a pas, et qu'une mention légale ne se déduit pas d'une habitude.
 *
 * Reste ouverte la région exacte de la base de données de production.
 */
export default function MentionsLegales() {
  return (
    <PageLegale titre="Mentions légales" mise_a_jour="27 novembre 2026">
      <Partie titre="Éditeur du site">
        <p>Dénomination sociale : XYNO</p>
        <p>
          Forme juridique : société à responsabilité limitée de droit belge
          (besloten vennootschap, BV/SRL)
        </p>
        <p>Siège social : Kuilenstraat 16, 3700 Tongeren, Belgique</p>
        <p>Numéro d’entreprise (BCE) : 0801.484.571</p>
        <p>Numéro de TVA : BE 0801.484.571</p>
        <p>
          Registre des personnes morales : tribunal de l’entreprise d’Anvers,
          division Tongeren
        </p>
        <p>Responsable de la publication : Zehra Dizer, gérante</p>
        <p>
          Contact :{" "}
          <a href="mailto:contact@zelicall.com">contact@zelicall.com</a>
        </p>
        <p>
          Zelicall est un service édité et exploité par XYNO. « Zeli » désigne
          l’assistante téléphonique du service.
        </p>
      </Partie>

      <Partie titre="Hébergement">
        <p>
          Le site et son application sont hébergés par Vercel Inc., 440 N
          Barranca Avenue #4133, Covina, CA 91723, États-Unis. Les fonctions
          serveur sont exécutées dans la région de Francfort (Allemagne).
        </p>
        <p>
          Les données applicatives — comptes, fiches clients, rendez-vous,
          enregistrements d’appels — sont hébergées par Supabase, Inc., 3500 S.
          DuPont Highway, Dover, Kent County, DE 19901, États-Unis, sur une
          base de données située dans l’Union européenne. Région exacte :{" "}
          <ACompleter quoi="région du projet Supabase de production" />.
        </p>
        <p>
          Les deux prestataires sont des sociétés américaines dont
          l’infrastructure utilisée ici est européenne. Les transferts de
          données éventuels vers les États-Unis, ainsi que les autres
          prestataires (téléphonie, intelligence artificielle, envoi de SMS),
          sont décrits dans la{" "}
          <a href="/confidentialite">politique de confidentialité</a>.
        </p>
      </Partie>

      <Partie titre="Propriété intellectuelle">
        <p>
          Les textes, l’interface, les illustrations et le code de ce site sont
          la propriété de XYNO, sauf mention contraire. Toute reproduction sans
          autorisation écrite est interdite.
        </p>
      </Partie>

      <Partie titre="Signaler un problème">
        <p>
          Pour signaler un contenu, une erreur ou une difficulté d’accès,
          écrire à{" "}
          <a href="mailto:contact@zelicall.com">contact@zelicall.com</a>, ou par
          courrier à XYNO, Kuilenstraat 16, 3700 Tongeren, Belgique.
        </p>
      </Partie>

      <Partie titre="Ce qui reste à faire avant publication">
        <p>
          L’identité de l’éditeur est complète. Reste à régler : la région
          exacte de la base de données, puis une relecture du document par un
          juriste compétent pour la Belgique et la France. Le bandeau de brouillon se
          retire ensuite dans{" "}
          <code className="rounded bg-ink-tint px-1.5 py-0.5 text-sm">
            src/components/public/legal.tsx
          </code>
          .
        </p>
      </Partie>
    </PageLegale>
  );
}
