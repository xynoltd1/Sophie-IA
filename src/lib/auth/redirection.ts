/**
 * Où aller après une connexion réussie.
 *
 * ## Pourquoi pas « / »
 *
 * « / » était le tableau de bord jusqu'à la 0.21.0. Depuis que la page
 * d'accueil publique existe, y renvoyer après une connexion réussie dépose
 * l'artisan sur la page commerciale : il vient de donner son mot de passe et
 * se retrouve devant « Essayer Zeli ». La page d'accueil a remplacé l'ancien
 * comportement sans que la connexion soit mise à jour.
 *
 * ## Pourquoi un module à part
 *
 * Un fichier marqué « use server » ne peut exporter que des fonctions
 * asynchrones. Cette fonction est pure : ici, elle se teste directement.
 *
 * ## Seuls les chemins internes sont acceptés
 *
 * `suite` est posé par le middleware, mais il arrive dans l'adresse de la
 * page de connexion : n'importe qui peut forger le lien. Une valeur
 * commençant par `//`, contenant un schéma ou un antislash est une adresse
 * externe déguisée. La laisser passer permettrait d'envoyer quelqu'un sur un
 * faux site juste après la saisie de son mot de passe, depuis un lien qui
 * porte notre nom de domaine.
 */
export function destinationApresConnexion(
  suite: FormDataEntryValue | null,
): string {
  const demande = typeof suite === "string" ? suite.trim() : "";

  const interne =
    demande.startsWith("/") &&
    !demande.startsWith("//") &&
    !demande.includes("\\") &&
    !demande.includes(":");

  return interne ? demande : "/app";
}
