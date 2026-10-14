/**
 * `server-only` lève une exception hors du runtime serveur de Next. C'est
 * voulu : le paquet existe pour faire échouer la compilation quand un module
 * serveur est importé par erreur dans le navigateur.
 *
 * Les tests s'exécutent sous Node, pas sous Next. Cet alias neutralise le
 * paquet pour eux. La protection reste entière au build, qui est ce qui
 * compte.
 */
export {};
