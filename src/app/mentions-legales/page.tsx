import type { Metadata } from "next";
import { ACompleter, PageLegale, Partie } from "@/components/public/legal";
import { metadonneesLegales } from "@/lib/seo/legal";

export const revalidate = 60;
export async function generateMetadata(): Promise<Metadata> {
  return metadonneesLegales("/mentions-legales", "Mentions légales");
}

export default function MentionsLegales() {
  return (
    <PageLegale titre="Mentions légales" mise_a_jour="6 novembre 2026">
      <Partie titre="Éditeur du site">
        <p>
          Dénomination sociale : <ACompleter quoi="raison sociale exacte" />
        </p>
        <p>
          Forme juridique : <ACompleter quoi="SRL, SA, indépendant…" />
        </p>
        <p>
          Siège social : <ACompleter quoi="adresse complète" />
        </p>
        <p>
          Numéro d’entreprise : <ACompleter quoi="BCE ou SIREN" />
        </p>
        <p>
          Numéro de TVA : <ACompleter quoi="numéro intracommunautaire" />
        </p>
        <p>
          Responsable de la publication : <ACompleter quoi="nom et qualité" />
        </p>
        <p>
          Contact : <ACompleter quoi="adresse e-mail de contact" />
        </p>
      </Partie>

      <Partie titre="Hébergement">
        <p>
          Le site est hébergé par <ACompleter quoi="nom de l’hébergeur" />,{" "}
          <ACompleter quoi="adresse de l’hébergeur" />.
        </p>
        <p>
          Les données applicatives sont hébergées par{" "}
          <ACompleter quoi="nom et région du fournisseur de base de données" />.
        </p>
        <p>
          Ces informations doivent nommer les prestataires réellement utilisés
          en production, avec leur région d’hébergement. Elles ne peuvent pas
          être déduites du code.
        </p>
      </Partie>

      <Partie titre="Propriété intellectuelle">
        <p>
          Les textes, l’interface, les illustrations et le code de ce site sont
          la propriété de l’éditeur, sauf mention contraire. Toute reproduction
          sans autorisation écrite est interdite.
        </p>
      </Partie>

      <Partie titre="Signaler un problème">
        <p>
          Pour signaler un contenu, une erreur ou une difficulté d’accès, écrire
          à <ACompleter quoi="adresse e-mail de signalement" />.
        </p>
      </Partie>

      <Partie titre="Ce qui reste à faire avant publication">
        <p>
          Remplir chaque champ ci-dessus, faire relire le document par un
          juriste compétent pour la Belgique et la France, puis retirer le
          bandeau de brouillon dans{" "}
          <code className="rounded bg-ink-tint px-1.5 py-0.5 text-sm">
            src/components/public/legal.tsx
          </code>
          .
        </p>
      </Partie>
    </PageLegale>
  );
}
