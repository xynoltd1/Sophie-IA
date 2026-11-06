import type { Metadata } from "next";
import { PageLegale, Partie } from "@/components/public/legal";
import { metadonneesLegales } from "@/lib/seo/legal";

export const revalidate = 60;
export async function generateMetadata(): Promise<Metadata> {
  return metadonneesLegales("/cookies", "Cookies et mesure d’audience");
}

/**
 * Pourquoi cette page ne porte pas de bandeau de consentement.
 *
 * La mesure d'audience de ce site ne dépose rien dans le navigateur : ni
 * cookie, ni stockage local, ni identifiant persistant. Le serveur compte une
 * visite à partir de ce qu'il voit de la requête, et n'en garde pas de quoi
 * reconnaître quelqu'un.
 *
 * Afficher malgré tout une fenêtre « acceptez-vous les cookies ? » serait un
 * mensonge poli : elle demanderait l'autorisation de faire une chose qu'on ne
 * fait pas, et habituerait le visiteur à cliquer sans lire.
 */
export default function Cookies() {
  return (
    <PageLegale
      titre="Cookies et mesure d’audience"
      mise_a_jour="6 novembre 2026"
    >
      <Partie titre="Il n’y a pas de bandeau, et c’est voulu">
        <p>
          Ce site ne dépose aucun cookie de mesure, aucun traceur publicitaire,
          aucun identifiant de suivi. Il n’y a donc rien à accepter ni à
          refuser, et une fenêtre de consentement vous demanderait
          l’autorisation pour quelque chose qui n’a pas lieu.
        </p>
      </Partie>

      <Partie titre="Ce qui est déposé dans votre navigateur">
        <p>
          <strong>Sur les pages publiques</strong> — ce site, avant toute
          connexion : rien.
        </p>
        <p>
          <strong>Une fois connecté à l’application</strong> : un cookie de
          session, strictement nécessaire pour vous garder identifié d’une page
          à l’autre. Sans lui, il faudrait saisir son mot de passe à chaque
          clic. Ce type de cookie ne requiert pas de consentement préalable.
        </p>
      </Partie>

      <Partie titre="Comment les visites sont comptées">
        <p>
          À l’affichage d’une page, le navigateur envoie au serveur le chemin
          visité, la provenance éventuelle, et la largeur de l’écran. Le serveur
          en tire un compte, puis range la ligne.
        </p>
        <p>
          Aucune adresse IP n’est conservée en clair, aucune empreinte de
          navigateur n’est calculée pour vous reconnaître d’une visite à
          l’autre, et ces données ne sont ni revendues ni partagées à des fins
          publicitaires.
        </p>
      </Partie>

      <Partie titre="Si vous ne voulez pas être compté">
        <p>
          Un bloqueur de contenu suffit : la requête de mesure est envoyée par
          le navigateur et peut être refusée. Le site fonctionne exactement de
          la même façon.
        </p>
        <p>
          Le signal « Do Not Track » ou « Global Privacy Control » de votre
          navigateur, s’il est activé, est également un refus que nous
          respectons côté serveur.
        </p>
      </Partie>

      <Partie titre="Si cela change">
        <p>
          Le jour où un outil déposant des cookies serait ajouté — mesure
          tierce, publicité, chat commercial — un véritable bandeau de
          consentement serait nécessaire, et cette page serait réécrite avant sa
          mise en service, pas après.
        </p>
      </Partie>
    </PageLegale>
  );
}
