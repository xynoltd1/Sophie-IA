/**
 * Les deux noms, et la différence entre eux.
 *
 * **Zelicall** est la plateforme : le service, le site, la facture, le nom
 * qu'on écrit dans un contrat.
 *
 * **Zeli** est l'assistante : la voix qui décroche, le prénom que le client
 * entend au téléphone.
 *
 * Les confondre est l'erreur que ce fichier existe pour empêcher. Un client
 * ne dit pas « j'ai parlé à Zelicall » ; il dit « j'ai parlé à Zeli ». Et une
 * entreprise ne s'abonne pas à Zeli, elle s'abonne à Zelicall.
 *
 * ## Pourquoi une constante et non une chaîne recopiée
 *
 * Avant la 0.22.0, le prénom de l'assistante était écrit en dur à quatorze
 * endroits. Le renommer a demandé de les retrouver tous, et un seul oubli
 * aurait fait apparaître l'ancien nom dans un coin de l'application. Le
 * prochain changement ne touchera que cette ligne.
 *
 * ## Ce que ce fichier ne décide pas
 *
 * Le nom réellement prononcé pendant un appel. Celui-là vient de la base,
 * organisation par organisation, et une entreprise qui a choisi « Camille »
 * garde « Camille ». Cette constante n'est que le point de départ d'un
 * nouveau compte, et le repli quand rien n'est configuré.
 */

/** Le nom du produit, du site et du service. */
export const PLATEFORME = "Zelicall";

/** Le prénom de l'assistante, pour un nouveau compte. */
export const ASSISTANTE_PAR_DEFAUT = "Zeli";
