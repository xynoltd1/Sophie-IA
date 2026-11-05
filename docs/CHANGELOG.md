# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Versionnement sémantique.

## [0.17.1] — 2026-11-05 — La page d'accueil sort du groupe de routes

### Corrigé : le déploiement échouait là où la compilation passait

```
Error: ENOENT: no such file or directory, lstat
'/vercel/path0/.next/server/app/(public)/page_client-reference-manifest.js'
```

Next.js n'émet pas le manifeste des composants clients pour une page d'accueil placée
dans un groupe de routes. En local, `npm run build` réussit ; sur Vercel, le déploiement
casse à l'étape qui suit la compilation. Le symptôme n'apparaît donc qu'au dernier
moment, là où il coûte le plus cher — et aucun des quatre contrôles habituels ne le voit.

La page est revenue à `src/app/page.tsx`, et l'en-tête, le pied de page et la mesure de
visite sont devenus `HabillagePublic`, un composant que toute page publique enveloppe.
Rien ne change pour le visiteur.

Un test refuse désormais qu'une page d'accueil réapparaisse dans un groupe de routes. Il
ne couvre pas une classe de bugs : il couvre celui-là, parce qu'il reviendra la prochaine
fois qu'on voudra ranger les pages publiques ensemble.

## [0.17.0] — 2026-11-04 — Une console, un site public, et de quoi les mesurer

Trois chantiers d'un coup, parce qu'ils se tiennent : on ne pilote pas ce qu'on ne mesure
pas, et on ne mesure pas un site qui n'existe pas.

### Le site public n'existait pas

`/` redirigeait vers la page de connexion. Le site n'avait **aucune page indexable** :
tout travail de référencement aurait porté sur rien.

Une vraie page d'accueil existe : ce que fait Sophie, comment un appel se déroule, ce
qu'elle refuse de faire, les questions fréquentes. Aucun chiffre inventé, aucun
témoignage, aucun logo de client — le produit n'a pas de client, et l'écrire serait un
mensonge vérifiable. L'argument, ce sont les limites : « elle n'invente pas un tarif »,
« elle ne confirme rien toute seule ». Un artisan méfiant des outils automatiques cherche
exactement cette information, et personne ne l'écrit (ADR-040).

### Référencement technique

- `robots.txt` et `sitemap.xml` générés, **muets hors production** : une préversion
  indexée fait concurrence au vrai site sur ses propres mots.
- Liste des pages publiques écrite à la main, jamais déduite des dossiers. Un plan du site
  est l'endroit où un moteur va chercher ce qu'il ne connaît pas ; un test refuse qu'une
  page privée y entre.
- Adresse de base, canonique, Open Graph, carte Twitter, langue.
- `noindex` sur `/app` et `/admin` — `robots.txt` n'est pas une protection, il publie même
  la liste des chemins qu'il prétend cacher.
- Données structurées : Organization, SoftwareApplication, FAQPage. **Ni prix ni note** :
  les déclarer sans les avoir est trompeur, et un test l'interdit.
- Vraie page 404, avec le bon code HTTP.
- La balise de propriété Search Console s'émet dès que `GOOGLE_SITE_VERIFICATION` existe —
  et seulement alors : une balise vide se lit comme une tentative ratée.

### Mesure de la fréquentation, sans cookie

Collecte maison, côté serveur. Ni adresse IP, ni agent utilisateur en base : ils servent à
classer puis disparaissent dans un hachage. Seul le domaine du référent est gardé — une
adresse de provenance peut contenir une requête de recherche.

L'empreinte de session **change chaque jour**. Le visiteur unique sur plusieurs jours est
donc perdu, et l'écran le dit : un chiffre dont on ignore le biais est pire qu'un chiffre
absent. En échange, pas de traceur, donc pas de bannière.

**Trois verdicts et non deux** : humain, robot, incertain. Aucune détection de robots
n'est sûre ; `UNKNOWN` porte l'incertitude au lieu de la cacher dans l'une des deux
certitudes. Huit couches de filtrage, de l'agent déclaré à la déduplication en base.

Aucun robot n'est bloqué : les exclure du comptage est une décision de mesure, pas de
sécurité. Googlebot doit parcourir le site (ADR-039).

### La console d'administration, refaite

Panneau vertical à gauche, dix rubriques en trois groupes, fixe sur ordinateur,
rétractable sur téléphone. Bloc compte en bas, avec une déconnexion qui **termine vraiment
la session Supabase** — un bouton qui viderait l'état du navigateur laisserait la personne
connectée sans le savoir.

Le panneau est vert profond quand l'application est claire. Quelqu'un qui a sous les yeux
les données de toutes les entreprises doit savoir d'un coup d'œil qu'il n'est plus chez
lui.

Nouveaux écrans : Statistiques, Utilisateurs, Appels et consommation, SEO et acquisition,
Mon compte. Graphiques tracés à la main en SVG — trois courbes ne valent pas cent
kilo-octets de JavaScript — chacun avec son tableau équivalent pour les lecteurs d'écran.
Export CSV avec point-virgule et BOM, sans quoi Excel en français ouvre le fichier en une
colonne.

### « Non disponible » est devenu une valeur

Chiffre d'affaires, coût fournisseurs, coût par minute, marge, revenu récurrent,
désabonnement, rétention : tous affichent **Non disponible**, avec la raison.

Aucun paiement n'est branché et le produit ne connaît aucun tarif fournisseur. Les estimer
donnerait une marge fausse, et une marge fausse oriente une décision de prix. Un test
l'interdit.

### Corrigé : la santé disait deux choses contradictoires

L'écran affichait « Testé en conditions réelles » juste au-dessus de « Variables
manquantes : VOICE_PROVIDER ». Les deux étaient exactes : l'une venait d'un registre écrit
à la main, l'autre de l'environnement lu à l'affichage.

Le défaut n'était pas l'affichage, c'était qu'un seul mot portait trois questions. Elles
sont séparées, et **le présent l'emporte** : une intégration mal configurée est hors
service, quel que soit son passé (ADR-038).

La preuve ne s'écrit plus à la main : chaque échange réel réussi la date lui-même. Les
opérations simulées n'écrivent rien — un résumé simulé ne prouve pas qu'un modèle répond.

### Migration 0033
`site_events`, `integration_checks`, et neuf fonctions d'agrégation réservées au super
administrateur. Tout est calculé en base : compter côté application obligerait à
rapatrier des milliers de lignes, et la somme serait fausse dès que la pagination s'en
mêlerait.

### Tests
383 au total, dont 20 nouveaux : plan du site sans page privée, canonique en HTTPS,
silence hors production, noindex des espaces privés, données structurées sans prix ni
note, reconnaissance des robots déclarés, refus de trancher quand on ne sait pas, chemins
privés jamais mesurés, aucune IP ni agent en base, réponse toujours identique du
collecteur, droits plateforme vérifiés sur **chaque** page d'administration, déconnexion
par action serveur, et aucun chiffre d'argent inventé.

### Documents
`docs/ADMIN_DASHBOARD.md`, `docs/SEO.md`, `docs/ANALYTICS.md` — nouveaux.
ADR-038, ADR-039, ADR-040.

## [0.16.0] — 2026-11-04 — Mot de passe oublié

### Nouveau : récupérer son mot de passe

L'application n'avait **aucune page** pour cela. Personne ne s'en était aperçu
parce que personne n'avait encore perdu son mot de passe.

C'est arrivé le 2026-11-04. Le bouton du tableau de bord Supabase envoie bien un
e-mail, mais son lien renvoie vers la racine du site : le code de récupération
n'y est jamais échangé, et la personne atterrit sur la page de connexion sans
message et sans comprendre. Pour un artisan, cela aurait voulu dire rester
dehors jusqu'à ce que quelqu'un aille dans Supabase à sa place.

Deux pages et deux actions :

- `/mot-de-passe-oublie` — demande le lien. Le lien pointe vers
  `/auth/callback?suite=/nouveau-mot-de-passe`, seul endroit qui sait échanger
  le code contre une session.
- `/nouveau-mot-de-passe` — pose le nouveau, exige une session, et connecte
  aussitôt.

La page de connexion porte maintenant le lien : une page de récupération que
personne ne trouve ne sert à rien.

**La réponse est la même que l'adresse existe ou non.** Un message qui distingue
les deux transforme le formulaire en annuaire : on y teste des adresses une par
une pour savoir lesquelles ont un compte. Le prix est une personne qui attend un
e-mail qui n'arrivera pas ; c'est le moindre mal, et c'est le même raisonnement
que pour « E-mail ou mot de passe incorrect » à la connexion.

### Tests
Quatre, dont un qui vérifie que le lien pointe vers `/auth/callback` et non vers
la racine — l'erreur exacte qui a coûté la matinée.

## [0.15.3] — 2026-11-04 — Les vues aussi

La migration 0031 bouclait sur `pg_tables`, qui ne contient pas les vues.
`public.calendar_status` a donc gardé `TRUNCATE`, `REFERENCES` et `TRIGGER` pour
`authenticated`.

Le risque réel est nul — vider une vue échoue à l'exécution. Ce qui comptait est
ailleurs : le contrôle ajouté à la suite d'isolation ne fait pas la différence
entre une table et une vue, donc il serait resté rouge. Un contrôle qui échoue
pour une raison bénigne finit par être ignoré, et c'est comme ça qu'on rate le
jour où il échoue pour une vraie raison.

La migration 0032 traite les vues, les vues matérialisées, les tables distantes
et les tables partitionnées — tout ce que `pg_tables` laissait de côté. Les
objets créés plus tard étaient déjà couverts : `alter default privileges ... on
tables` s'applique aussi aux vues.

## [0.15.2] — 2026-11-03 — Un droit que RLS n'arrête pas

### Corrigé : `authenticated` pouvait vider n'importe quelle table

Trouvé sur la base de production, en comparant ses réglages à ceux d'une base
neuve. Le rôle `authenticated` — c'est-à-dire **tout utilisateur connecté** —
possédait le droit `TRUNCATE` sur les **trente-quatre tables** du schéma public.
`calls`, `contacts`, `appointments`, `audit_logs` comprises.

L'origine n'est pas dans notre code : à la création d'un projet, Supabase pose un
privilège par défaut qui accorde `Dxtm` à `authenticated` sur toute table créée
ensuite par le rôle `postgres` — donc sur toutes les nôtres. Le `D`, c'est
TRUNCATE.

**Pourquoi c'est sérieux.** TRUNCATE ignore la sécurité au niveau ligne. Aucune
policy ne l'arrête : RLS filtre des lignes, TRUNCATE supprime la table entière
sans les lire. C'est le seul droit du catalogue qui traverse toute notre
architecture d'isolation.

**Pourquoi ce n'était pas une urgence.** L'API REST de Supabase n'expose pas
TRUNCATE, et un navigateur ne parle jamais à Postgres directement. Il aurait
fallu une fonction SQL `security invoker` qui le fasse — nous n'en avons aucune.
C'était un droit que personne n'utilisait, que rien ne justifiait, et qui serait
devenu exploitable le jour où quelqu'un aurait écrit la mauvaise fonction.

La migration 0031 le retire des tables existantes **et** des privilèges par
défaut, sinon la migration suivante rouvrait le trou. `REFERENCES` et `TRIGGER`
partent avec : un utilisateur connecté n'a aucune raison de poser une clé
étrangère ou un déclencheur sur nos tables. Les droits sur les séquences aussi :
les identifiants sont générés par la base, jamais par le client.

### Tests
Deux nouveaux. Un test statique vérifie que la migration traite les tables
existantes **et** les futures. Un contrôle ajouté à la suite d'isolation relit
les droits réels de la base plutôt que de faire confiance à la migration — parce
qu'une table créée un jour depuis l'interface Supabase, par un autre rôle, ne
serait pas couverte.

### Ce que cet épisode dit de la méthode
La faille n'a été trouvée ni par le typecheck, ni par le lint, ni par les 338
tests, ni par le build. Elle a été trouvée en créant une deuxième base et en
comparant ses réglages à ceux de la première. Les contrôles automatiques
vérifient ce qu'on a pensé à vérifier.

## [0.15.1] — 2026-11-02 — Le plan d'action du propriétaire

Aucun changement de comportement. Documentation, et trois corrections de documentation
trouvées en auditant la 0.15.0 pour écrire ce plan.

### Nouveau : `docs/OWNER_ACTION_PLAN.md`
La liste exhaustive de ce que la propriétaire doit faire elle-même pour mettre Sophie en
service, en trois temps — déployer, tester avec de vrais appels, vendre — avec pour chaque
action : ce qu'il faut faire, pourquoi, le site, les menus, les valeurs, le nom exact des
variables, où les placer, le coût, le résultat attendu, comment le vérifier et quoi faire si
ça échoue. Trente-trois cases à cocher, un tableau récapitulatif, le scénario de validation
de bout en bout et un rapport d'état.

### Corrigé : trois divergences entre la documentation et le code

**`DEPLOYMENT.md` annonçait un webhook de téléphonie sur `/api/webhooks/telephony`.** Cette
route n'existe pas et n'a jamais existé. Déclarer cette URL chez un fournisseur donne des
webhooks qui tombent dans le vide, sans erreur visible. Le tableau des URL liste maintenant
les six vraies : outils et événements de voix, SMS entrant, accusé de réception, et les deux
tâches planifiées. La raison de l'absence d'adaptateur opérateur est expliquée sur place
(ADR-002 : le son ne passe jamais par Vercel, donc un numéro se rattache à l'assistant
vocal, pas à une route de l'application).

**`DEPLOYMENT.md` annonçait une tâche planifiée.** `vercel.json` en déclare deux depuis la
0.13.0, et la seconde porte les six purges de conservation. Le tableau dit maintenant ce que
chacune fait.

**`providers/status.ts` annonçait « seize migrations appliquées ».** Il y en a trente
écrites, et six ne sont pas encore appliquées sur la base de production. Le registre le dit
et renvoie à l'étape A2 du plan.

## [0.15.0] — 2026-11-02 — La ligne, la conservation, et six pannes qui se voient

Les sept problèmes listés comme « non corrigés » dans l'audit fonctionnel ont été repris
par ordre de criticité. Six sont traités ; le septième demande un appel réel.

### Un écran pour la ligne téléphonique
`/app/sophie/ligne`. Jusqu'ici `phone_numbers` s'écrivait en SQL à la main, et comme la
table était vide, **tous les appels tombaient dans le repli « essai »** — ce qui expliquait
pourquoi aucun appel réel n'apparaissait nulle part.

L'écran déclare un numéro, son fournisseur, son état, et son mode de raccordement. Trois
modes existent dans le modèle (`line_connection_mode`) :

- **renvoi** depuis la ligne que le professionnel possède déjà, avec les codes GSM à
  composer (`**61*…*11*20#` pour « après 20 secondes sans réponse ») ;
- **numéro dédié** fourni par l'opérateur programmable ;
- **portabilité** du numéro existant.

Ce que l'écran ne fait pas : fabriquer un numéro. Sans fournisseur configuré, il le dit.
La date de premier appel reçu (`verified_at`) est posée par le webhook et non par le
formulaire : c'est la seule preuve qu'un renvoi fonctionne vraiment.

### Conservation et purge des données d'appel
Migration 0030. L'audio avait sa politique depuis 0.11.0 — 30 jours au plus, ADR-013. La
transcription, le résumé et les messages, eux, restaient indéfiniment. Garder indéfiniment
n'est pas une décision neutre : c'est une décision par omission, et c'est celle qu'un
contrôle reproche.

- Trois durées réglables par entreprise, entre 30 jours et 5 ans, dans
  `/app/reglages/conservation`.
- Trois fonctions de purge qui lisent la durée **de chaque** organisation : une entreprise
  qui a choisi 90 jours ne subit pas le défaut d'une autre.
- Un journal d'exécution, `retention_runs`, lisible du seul super administrateur. Une purge
  sans trace ne peut ni se prouver à un client qui demande l'effacement de ses données, ni
  se diagnostiquer quand elle échoue depuis trois semaines.
- Six purges indépendantes dans la tâche planifiée. Une purge bloquée retarde les autres
  d'une journée au lieu de les empêcher toutes.
- Les fichiers partent **avant** les lignes qui les désignent. L'ordre inverse laisserait
  des objets que plus rien ne référence, donc que plus rien ne supprimerait jamais.

Les durées par défaut — un an — sont un choix technique, pas un avis juridique. L'écran le
dit au professionnel.

### Un écran de tâches
`/app/taches`, quatre vues : en retard, aujourd'hui, à faire, terminées.

L'accueil annonçait « 3 tâches en retard » et renvoyait vers un filtre de prospects qui ne
connaissait pas ce mot. Le compte était juste ; le lien ne menait nulle part.

Une tâche datée du jour était aussi déclarée « en retard » à une heure du matin : l'échéance
était posée à minuit UTC. Elle est désormais posée en fin de journée dans le fuseau de
l'entreprise (ADR-029).

### Six pannes qui se voient enfin
`provider_errors` n'était alimentée que par les échecs SMS. Elle l'est maintenant par six
chemins : SMS refusé, rendez-vous non poussé dans Google, synchronisation ratée, résumé
impossible, événement vocal rejeté, audio perdu.

Un `console.error` ne se mesure pas, et les journaux de l'hébergeur expirent. Une panne de
trois jours y ressemblait à trois accidents isolés. Le journal des purges apparaît sur le
même écran de santé.

### Deuxième passe de design
Pas un changement de couleurs : un changement de hiérarchie.

- **L'accueil empilait six cartes ambre identiques** — une urgence, un rendez-vous à
  valider, des appels sans suite, des prospects, des tâches. Six signaux de même poids ne
  font pas six priorités, ils font un mur. L'urgence garde seule sa carte colorée ; le reste
  tient dans une surface unique, une ligne par sujet, le nombre en tête et aligné.
- **L'heure mène la journée.** Sur l'accueil comme sur l'agenda, l'heure est la première
  colonne, en chasse tabulaire. Un artisan lit son agenda par heures, pas par intitulés.
- **La liste des appels** empilait recherche, filtres, périodes et un lien de corbeille :
  quatre rangées avant le premier appel, donc aucun appel visible sur un téléphone. La
  période est devenue une liste déroulante — native sur mobile — et partage le bouton.
- **Les étiquettes qui ne distinguaient rien ont disparu.** « Enregistrement » figurait sur
  presque chaque appel ; un chevron ▶ devant la durée dit la même chose sans occuper de
  place. « Terminé » n'apparaît plus : seul un statut anormal s'affiche.
- **L'en-tête ne porte plus qu'un seul objet d'état.** Les alertes étaient un nombre encadré
  à côté du badge de Sophie ; deux cadres de même taille se lisent comme deux états. Les
  alertes sont redevenues une cloche avec une pastille.
- **Nouveau relevé sur l'accueil** : « Sophie, ces sept jours » — appels pris, prospects,
  rendez-vous. Trois nombres, pas une courbe.
- Les barres fixes sont posées sur `paper-deep`, le ton prévu pour elles depuis la Phase 0
  et jamais employé. Un jeton déclaré et jamais utilisé est une intention, pas une décision :
  un test l'interdit désormais.
- Trois cibles tactiles de 40 px passées à 44 px.

### Tests
338 tests, 17 ignorés faute de `SUPABASE_TEST_*`. Les nouveaux :

- `tests/retention.test.ts` — bornes en base, durée propre à chaque entreprise, journal
  réservé à la plateforme, ordre fichiers-avant-lignes, et **un filet qui vérifie que chaque
  `rpc()` du code correspond à une fonction existante dans une migration**. Un nom de
  fonction erroné échouait jusqu'ici en production et nulle part ailleurs.
- `tests/observability.test.ts` — les six chemins d'échec consignent, et le journal reste
  invisible du client.
- `tests/design-system.test.ts` — **aucun composant client n'importe un module
  `server-only`** (cette erreur casse le build et seul le build la voit), aucun jeton de
  couleur mort, une seule définition des puces de filtre, cible tactile minimale de 44 px.

### Ce qui reste hors de portée d'ici
- Les connaissances de Sophie sont lues par l'outil et testées ; **leur usage réel pendant
  un appel n'est pas vérifié** — le fournisseur vocal ne peut pas être appelé depuis cet
  environnement.
- Les durées de conservation attendent une validation juridique.
- Voix et style de Sophie se règlent toujours chez le fournisseur vocal.

## [0.14.0] — 2026-11-02 — La liste des appels, et un bug vieux de deux mois

### Corrigé : la liste de l'équipe ne s'était jamais chargée
« Cette information n'a pas pu être chargée. »

`organization_members.user_id` et `profiles.id` pointent tous les deux vers les comptes
d'authentification, mais **aucune clé étrangère ne relie les deux tables**. PostgREST ne
peut donc pas déduire la relation, et toute requête qui demande le nom d'un membre échoue.
Le code était là depuis la Phase 0 ; il n'a jamais fonctionné.

Migration 0029 : les profils manquants sont créés, puis la clé étrangère est posée. Une
équipe réduite au seul propriétaire est un état normal, et elle s'affiche normalement.

### La liste des appels est paginée, filtrée et cherchable
Tout se décide en base, dans une seule fonction SQL : filtres, tri, comptage.

- Dix appels par page par défaut, 20 ou 50 au choix. Dix parce que l'application se lit
  d'abord sur un téléphone, et que dix cartes remplissent déjà un écran.
- Recherche par nom, entreprise ou numéro.
- Filtres : sans suite, rendez-vous, urgents, échoués, essais. Et une période.
- **Affichage de 1 à 10 sur 147 appels**, avec Précédent / Suivant.
- Les filtres vivent dans l'adresse : une recherche se partage et le bouton Retour
  fonctionne.

Deux pièges évités, et c'est le cœur du travail : le filtre « sans suite » ne peut pas se
calculer sur une page partielle, et l'ordre doit être déterministe — sans tri secondaire,
deux appels à la même seconde peuvent se répéter ou disparaître entre deux pages.

### Supprimer un appel (ADR-035)
Une corbeille, pas un effacement. Sélection multiple, confirmation qui dit ce qu'elle fait,
réservée aux responsables, journalisée. Trente jours pour revenir en arrière, puis le
fichier audio part avant la ligne — jamais l'inverse, sinon le fichier devient orphelin.

La suppression n'emporte ni rendez-vous, ni contact, ni demande. Un test le vérifie.

### Sophie lit enfin les connaissances
L'écran « Connaissances de Sophie » existait depuis 0.13.0, et rien de ce qu'on y écrivait
n'atteignait un appel : l'outil n'avait pas de paramètre pour la question du client. Il en
a un, et les consignes de comportement remontent avec la réponse.

### Design : ce qui change, et ce qui ne change pas
La direction visuelle est conservée — fond non blanc contre l'éblouissement, couleur
réservée au statut, arête de couleur sur les blocs qui demandent une action. Elle est bonne
pour un artisan en extérieur, et la remplacer aurait été du goût, pas du progrès.

Ce qui est ajouté : une ombre très basse sur les blocs, un retour au doigt sur les cartes
cliquables (120 ms), deux composants partagés — `Badge` et `Chip` — qui remplacent les
`<span>` stylés à la main qui s'étaient multipliés, et un téléchargement de
l'enregistrement depuis la fiche d'appel.

### Ajouté
`docs/FUNCTIONAL_AUDIT.md` : l'état réel de chaque fonctionnalité, vérifié dans le code et
non repris des anciens documents. Il liste aussi sept problèmes connus non corrigés, avec
leur priorité et la raison.

## [0.13.0] — 2026-11-02 — Tout ce qui pouvait être construit sans comptes externes

Développement autonome d'une traite : intelligence post-appel, workflow complet des
rendez-vous, écrans de réglages, administration de la plateforme, conversations.

### Résumé et extraction, produits par nous (ADR-031)
Le fournisseur de voix accepte notre plan d'analyse, le stocke, le renvoie actif quand on
l'interroge — et exécute les appels avec l'analyse désactivée. Trois corrections n'y ont
rien changé.

Le résumé et les dix champs structurés de la section 15 sont désormais produits à partir de
la transcription conservée en base. Nouvelle abstraction `AIProvider`, compatible avec les
interfaces de type OpenAI, donc avec Mistral, Groq ou un serveur local sans changer une
ligne. Reprise automatique, bouton « Réessayer », et un résumé simulé qui **annonce qu'il
est simulé** tant qu'aucune clé n'est configurée.

### Workflow complet du rendez-vous (ADR-032, ADR-034)
- **Refuser** avec un motif, qui part dans le message au client.
- **Proposer un autre horaire** : le client répond par un lien, sans compte. Le rendez-vous
  ne devient confirmé que s'il accepte, et le créneau d'origine reste bloqué d'ici là.
- **Annuler**, avec synchronisation de l'agenda Google.
- **File de messages sortants** : on met en file, puis on envoie. Un échec d'envoi n'annule
  jamais le rendez-vous, et le message reste réessayable.
- **Adaptateur SMS réel** écrit contre la documentation de l'opérateur, jamais exercé :
  aucun compte n'existe. Il est marqué comme tel.
- **Notifications** avec déduplication, pastille dans l'en-tête, écran dédié.
- **Accusés de réception** et **SMS entrants** branchés sur des webhooks signés.

### Écrans qui manquaient
Services, horaires, absences et vacances, équipe avec invitations, connaissances de Sophie,
intégrations, consommation du mois. Tous reliés à de vraies données, tous avec contrôle de
rôle côté serveur — pas seulement un bouton caché.

### Administration de la plateforme (ADR-033)
Espace `/admin` séparé : entreprises, métiers modifiables **sans toucher au code**, offres,
abonnements, consommation, erreurs des fournisseurs, santé des intégrations. Chaque écriture
est journalisée.

**Aucun accès aux enregistrements des clients**, par construction, et un test parcourt tout
le code de cet espace pour le vérifier.

### Conversations
Entité `Conversation` avec les cinq canaux de la section 18. SMS entrant et sortant
fonctionnels ; WhatsApp, e-mail et formulaire web structurés mais non branchés — dit
franchement plutôt que suggéré.

La fiche contact réunit maintenant appels, messages, rendez-vous et demandes dans un seul
fil chronologique.

### Ce qu'un test a rattrapé pendant ce développement
Le formulaire de proposition d'horaire lisait `datetime-local` avec `new Date()`, donc dans
le fuseau du serveur : exactement le décalage de l'ADR-029, à un endroit neuf. Le test
écrit après ce bug-là a échoué avant le déploiement. Il couvre désormais tout `src`, pas
seulement les outils de Sophie.

### Pourquoi ce n'est pas une version 1.0 candidate
Trois fonctions majeures n'ont jamais été exercées contre un service réel : le résumé (pas
de clé d'IA), le SMS (pas de compte opérateur), l'appel sur un vrai numéro (pas de numéro).
Et la liste juridique reste ouverte. Appeler cette version « candidate » serait exactement
le genre d'annonce que ce projet s'interdit.

## [0.12.3] — 2026-10-23 — Un tableau vide invalide, et un fournisseur silencieux

### Ce que le rapport a montré
L'assistant utilisé pendant l'appel (version 28) portait **mes instructions de résumé**,
mot pour mot — et `enabled: false`. Le plan d'extraction, lui, avait entièrement disparu.

Le fournisseur a donc accepté une partie de l'envoi et nettoyé le reste, sans un mot. Le
script avait pourtant relu l'assistant juste après et lu `enabled: true`.

### La cause probable
Le schéma d'extraction contenait `"required": []`. Un tableau `required` vide est
**invalide en OpenAPI 3.0**, la spécification contre laquelle le fournisseur valide les
schémas. L'absence de la clé dit exactement la même chose — aucun champ obligatoire — et
reste valide. Elle a été retirée.

### Deux écritures au lieu d'une
Le plan d'analyse part maintenant dans une requête séparée de celle des outils. Une
écriture unique ne permet pas de savoir laquelle des deux parties a été refusée.

### Le script montre ce qui est gardé
Après écriture, il affiche le plan d'analyse **tel que le fournisseur le conserve**, en
entier. Un booléen « actif / inactif » ne dit pas qu'un bloc complet a disparu de l'envoi.
S'il manque quelque chose, le script le dit au lieu d'annoncer un succès.

### La leçon
Trois fois aujourd'hui, un service externe a accepté une requête et fait autre chose que ce
qui était demandé. Le seul remède qui a fonctionné à chaque fois : relire l'état réel après
écriture, et afficher ce qu'on a lu — pas ce qu'on a envoyé.

## [0.12.2] — 2026-10-23 — Savoir ce que l'assistant porte avant d'écrire

Le rapport d'un appel de 19 h 55 contenait la configuration réellement utilisée :
`summaryPlan.enabled: false`, `messages: []`. Pas « absent » : **explicitement désactivé**.
Or le script avait relu l'assistant une heure plus tôt et affiché « activés et vérifiés ».

Entre les deux, une sauvegarde faite dans le tableau de bord du fournisseur. L'interface
renvoie l'assistant **entier**, réglages compris, et écrase ce qu'un script a poussé.

### Ajouté
`npm run vapi:tools` affiche désormais l'état de l'assistant **avant** toute écriture :
résumé actif ou non, extraction active ou non, nombre d'outils rattachés. Sans cette
lecture, on ne peut pas distinguer « mon réglage n'a jamais été écrit » de « mon réglage a
été écrasé depuis », et les deux appellent des corrections opposées.

Le script rappelle aussi, à chaque exécution, qu'une modification faite à la main dans le
tableau de bord annule ces réglages.

## [0.12.1] — 2026-10-23 — La bonne adresse du fichier audio

### Le symptôme
« L'enregistrement n'a pas pu être récupéré ». L'erreur conservée par l'application disait
exactement ce qu'il fallait : **le fournisseur a répondu 400**.

### La cause
`message.recordingUrl` est l'adresse **brute** du fichier chez l'hébergeur du fournisseur.
Elle n'est pas signée, et la demander renvoie une erreur. Les seules adresses
téléchargeables sont les `presigned...`, qui figuraient dans le rapport sans que le code
les regarde.

L'ordre de recherche commence désormais par `presignedMonoUrl` — la conversation mixée sur
une piste, deux fois plus légère que la stéréo, et c'est ce qu'un artisan veut écouter. Les
adresses brutes restent en dernier recours.

### Deuxième garde-fou, ajouté au passage
Un hébergeur qui répond `application/octet-stream` — « des octets, débrouillez-vous » — ne
fait plus perdre l'enregistrement : le type est alors déduit de l'extension de l'adresse,
signature exclue.

### Ce qui aurait manqué sans la version précédente
L'erreur était conservée en base, en clair, lisible en une requête. Sans elle, la seule
information disponible aurait été « ça ne marche pas ».

## [0.12.0] — 2026-10-23 — L'audio arrive chez vous

Fin de la Phase 5. « Écouter l'appel » n'est plus un bouton décoratif.

### Ajouté
- **Migration 0024** : un bucket **privé** `call-recordings`. Aucune policy n'y est posée,
  et c'est délibéré : seul le serveur y accède. Un navigateur ne doit même pas pouvoir
  essayer.
- **Rapatriement de l'enregistrement** juste après l'appel, dans le traitement du webhook.
  Pas dans une tâche de nuit : les adresses du fournisseur expirent, une tâche nocturne ne
  trouverait que des liens morts.
- **Route `/api/calls/[id]/audio`**. L'interface pointait vers elle depuis la Phase 4 alors
  qu'elle n'existait pas — un lecteur branché sur une 404 ne dit rien, il reste muet. Elle
  vérifie la session, vérifie que l'appel appartient à l'entreprise active, puis redirige
  vers une adresse signée valable cinq minutes.
- **Écran Sophie → Enregistrement des appels.** Il dit d'abord ce qui est vrai, et demande
  ensuite. Il distingue surtout les deux choses que tout le monde confond : l'opérateur
  enregistre de son côté selon ses règles, ce réglage ne gouverne que la copie conservée
  chez vous.
- **L'écran Sophie devient un vrai écran** : état de la ligne, et ce qui se règle.

### Corrigé
- **Le drapeau d'essai d'un appel ne suffisait pas à autoriser l'enregistrement.**
  `call_is_test()` exige que l'ORGANISATION soit une organisation d'essai (ADR-019). Sans
  ce passage, un appel réel marqué essai — ce qui arrive tant qu'aucun numéro n'est
  déclaré — aurait profité de la dispense réservée aux essais. La base le vérifiait déjà ;
  le serveur ne le lui demandait pas correctement.

### Sécurité du chemin de fichier
Le chemin est calculé par le serveur à partir de deux identifiants, et la fonction refuse
tout ce qui n'est pas un UUID. Un chemin construit à partir d'une valeur libre est une
traversée de répertoire qui attend son heure : `../autre-entreprise/appel.mp3` est une
chaîne parfaitement valide.

### Ce qui reste avant un vrai client
L'annonce applicable au pays n'est pas validée juridiquement, donc `recording_allowed()`
refuse l'enregistrement de tout appel réel. C'est voulu. Les appels d'essai, eux, sont
conservés.

## [0.11.1] — 2026-10-23 — Le résumé, et la vérité sur l'enregistrement

### Le résumé était vide, et rien ne le disait
Le premier rapport réel contenait bien un champ `summary`. Vide. `analysis` existait, sans
rien dedans : l'analyse n'était pas activée chez le fournisseur. Aucune erreur, aucun
journal, juste une fiche d'appel avec « Résumé indisponible ».

Le plan d'analyse vit maintenant dans le code (`src/lib/sophie/analysis.ts`) et part sur
l'assistant avec les outils, par `npm run vapi:tools -- --apply`. Le script relit ensuite
l'assistant pour **constater** que le résumé est actif, au lieu de l'annoncer sur la foi
d'un code HTTP.

Il emporte aussi l'extraction structurée de la section 15 — intention, service, urgence,
nom, adresse, date et heure souhaitées, description du problème, rendez-vous demandé,
rappel demandé. Aucun champ n'est obligatoire : un schéma qui exige une valeur pousse le
modèle à en fabriquer une.

### Corrigé : l'application mentait sur l'enregistrement
La fiche affichait « Cet appel n'a pas été enregistré » alors que le fournisseur, lui,
enregistre par défaut — le rapport contient `recordingUrl`, `stereoRecordingUrl` et des
adresses signées. Le texte dit désormais ce qui est vrai : « Nous ne conservons pas
l'enregistrement de cet appel. Le fournisseur de téléphonie peut en détenir une copie de
son côté. »

La nuance n'est pas de forme. L'une des deux phrases informe l'artisan, l'autre lui fait
croire qu'aucun enregistrement n'existe.

### Contrainte découverte dans le rapport réel
`presignedUrlsExpiresAt` : les adresses du fichier audio expirent. Le rapatriement devra se
faire dans les minutes qui suivent l'appel, pas dans une tâche de nuit. Cette contrainte
aurait été découverte beaucoup plus tard sans la conservation du rapport brut.

### Retiré
Le bandeau de bas de fiche qui répétait « Résumé indisponible » alors que la section
au-dessus le disait déjà.

## [0.11.0] — 2026-10-23 — Sophie raconte ce qui s'est dit

Début de la Phase 5. La transcription et le résumé d'abord, l'audio ensuite.

### Ajouté
- **La fiche d'appel affiche la conversation**, tour par tour, avec le moment où chaque
  phrase a été dite. Cet horodatage n'est pas décoratif : c'est lui qui permettra de
  cliquer sur un passage et d'y placer le lecteur audio (section 14). L'enregistrer
  maintenant évite d'avoir à retraiter tous les appels passés plus tard.
- **Le résumé de Sophie s'affiche vraiment**, à la place du texte d'attente.
- **Migration 0023** : `call_events` garde le rapport **brut** du fournisseur, avant toute
  interprétation. Si notre lecture se trompe, la conversation n'est pas perdue et
  l'extraction peut être rejouée. Le rapport se purge à trente jours comme l'audio : il
  contient la transcription, donc des données personnelles.
- `call_transcript_segments` et les colonnes `calls.summary` / `calls.structured_data`.

### Pourquoi la lecture du rapport est si défensive
La forme exacte du rapport varie selon la version du fournisseur et selon que l'appel vient
d'un numéro ou du navigateur. `src/lib/calls/report.ts` cherche chaque valeur à tous les
emplacements connus et renvoie `null` quand elle est introuvable. Un résumé absent
s'affiche comme absent ; un résumé inventé mentirait.

Les tests de ce fichier utilisent la forme **réellement observée** sur un appel du
22 octobre, pas celle de la documentation.

### Ce qu'un test a rattrapé avant le déploiement
L'index unique de `call_events` était partiel. Un index partiel ne peut pas servir
d'arbitre à un `ON CONFLICT` — c'est l'erreur exacte de l'ADR-025, qui avait fait échouer
la connexion d'un agenda. `tests/upsert-constraints.test.ts`, écrit après cet incident, a
fait échouer la suite immédiatement. Le garde-fou a payé.

### Ce qui reste pour finir la Phase 5
L'audio. Il demande d'abord un écran pour activer l'enregistrement et accepter la politique
applicable : aujourd'hui, `recording_allowed()` renvoie faux pour toute organisation, et
c'est volontaire (section 42).

## [0.10.1] — 2026-10-23 — L'application dit pourquoi elle ne dit rien

### Ce qui s'est passé
Deux heures passées à chercher pourquoi l'accueil restait vide après un appel. La réponse
était juste : aucun numéro de téléphone n'est relié à l'entreprise, donc tous les appels
sont marqués « essai », et un essai ne déclenche jamais d'alerte. L'application le savait.
Elle ne le disait pas.

### Corrigé
- **« Sophie en pause » était écrit en dur.** `const sophieActive = false` dans la mise en
  page depuis la Phase 0. L'en-tête annonçait donc une Sophie en pause alors qu'elle venait
  de tenir une conversation. L'état est maintenant calculé : numéro relié, numéro réel ou
  d'essai, Sophie activée, mode de réponse. Un test interdit de réécrire cette constante.
- **L'accueil explique son silence.** Un bandeau dit laquelle des quatre conditions manque,
  dans l'ordre où il faut les traiter — sans numéro, activer Sophie ne sert à rien.
- **Les dates n'ont plus de majuscules partout.** « Vendredi 23 Octobre À 11:21 » devient
  « Vendredi 23 octobre à 11:21 » : `capitalize` met une majuscule à chaque mot.

### Ce que cette version ne corrige pas
Il n'existe toujours aucun écran pour déclarer un numéro de téléphone : la table
`phone_numbers` s'écrit en SQL. Tant qu'elle est vide, aucun appel réel ne peut être reçu —
le serveur ne sait pas à quelle entreprise il appartient et le laisse tomber.

## [0.10.0] — 2026-10-22 — Un client qui appelle et repart sans rien ne disparaît plus

### Le trou
Un client appelle, parle, raccroche sans expliquer son problème ni prendre de rendez-vous.
Jusqu'ici, cet appel n'apparaissait nulle part ailleurs que dans l'onglet Appels. Personne
ne le rappelait. C'était la seule perte totalement invisible du produit.

### Ajouté
- **Lien direct appel → demande, rendez-vous, rappel.** Migration 0022 : `call_id` sur
  `leads`, `appointments` et `tasks`. L'ancienne déduction par contact et fenêtre de temps
  se trompait dès que le même client rappelait dans la journée, et surtout elle ne savait
  pas conclure à l'absence (ADR-030).
- **Trois nouvelles lignes sur l'accueil** : rendez-vous à valider, appels à rappeler,
  appels que Sophie n'a pas pu prendre. Les rendez-vous à valider manquaient : un créneau
  provisoire pour la semaine suivante n'apparaissait que dans l'agenda, alors que c'est la
  décision la plus urgente que Sophie produise.
- **Filtres sur la liste des appels** : Tous, Sans suite, Échoués. Un appel sans suite
  porte la mention « Rien n'a été noté pendant cet appel ».
- **Fiche appel complète** (section 31) : la demande enregistrée et les rappels créés
  pendant l'appel s'affichent, ou un bloc qui dit franchement que rien n'en est sorti.

### Corrigé
- **Une tâche « rappelez-moi demain à 8 h » était créée à 9 ou 10 heures** selon la saison.
  Même faute que le décalage des rendez-vous corrigé en 0.9.0, au même endroit du code,
  restée dans l'ombre parce qu'une heure d'écart sur un rappel ne se remarque pas. La règle
  est désormais écrite une fois (ADR-029) et un test interdit de la contourner.

### Les garde-fous de cette version
La règle « appel sans suite » vit à deux endroits : en base pour le compteur de l'accueil,
dans l'application pour le filtre de la liste. Deux tests relient les deux — l'un sur les
seuils (15 secondes, 7 jours), l'autre qui vérifie que les colonnes renvoyées par
`dashboard_counts()` correspondent exactement au type TypeScript. Sans ce second test, une
colonne ajoutée d'un côté et pas de l'autre donnerait un compteur silencieusement à zéro.

### Reprise de l'historique
La migration rattache une dernière fois les lignes existantes par l'ancienne heuristique.
Sans cela, tous les appels déjà passés seraient apparus comme « sans suite » au premier
chargement, y compris celui qui a produit un rendez-vous.

## [0.9.1] — 2026-10-22 — Un numéro mal entendu est pire qu'un numéro absent

### Le problème
La transcription a rendu `04 72 12 34` pour un numéro dicté au téléphone — trop court pour
exister. Le serveur l'a enregistré sans rien signaler. L'artisan aurait rappelé dans le
vide, ou dérangé quelqu'un qui n'a jamais appelé.

### Trois protections, de la plus solide à la plus faible

**Le serveur refuse l'impossible.** `src/lib/crm/phone.ts` vérifie la vraisemblance avant
toute écriture. Strict pour la France et la Belgique, dont les longueurs sont connues ;
permissif ailleurs, parce que prétendre connaître tous les plans de numérotation ferait
perdre de vrais clients. Le refus est formulé pour être prononcé : « il en faut neuf,
faites-le répéter chiffre par chiffre ».

**Un numéro dicté n'écrase jamais un numéro du réseau.** Le réseau ne se trompe pas, la
reconnaissance vocale si. Remplacer le certain par l'incertain serait une perte sèche.

**L'artisan voit la différence avant de composer.** Migration 0021 : `contacts.phone_origin`
vaut `NETWORK`, `DICTATED` ou `MANUAL`. La fiche contact affiche « Numéro communiqué par
l'appelant, pas transmis par l'opérateur. À vérifier. »

### Et une quatrième, qui dépend de Sophie
La description du paramètre lui demande de relire le numéro chiffre par chiffre et de le
faire confirmer. C'est la moins fiable des quatre — elle dépend du modèle — d'où sa place
en dernier.

### Portée réelle
En production, le numéro vient du réseau et ce problème ne se pose presque jamais. Il ne
concerne que les appels masqués, et les essais depuis le navigateur — qui n'ont jamais de
numéro, donc tombent dans ce cas à chaque fois.

## [0.9.0] — 2026-10-22 — Premier appel complet, et le décalage horaire

**Le scénario du cahier des charges a fonctionné de bout en bout.** Un appel, un contact
créé, une demande enregistrée en urgent, un rendez-vous « À valider » visible dans l'agenda.

### Corrigé
- **Un rendez-vous demandé à 8 h était enregistré à 10 h.** `new Date("...T08:00:00")` sans
  suffixe est interprété dans le fuseau de la machine ; sur Vercel, cette machine est en
  temps universel. L'heure dictée par le client est une heure **murale** : elle est
  désormais convertie dans le fuseau de l'organisation.

### Pourquoi ce bug était difficile à voir
Les deux valeurs sont des heures parfaitement valides. Aucune erreur n'est levée, rien
n'est anormal dans les journaux. Seul un humain qui compare ce qu'il a dit et ce qu'il voit
s'en aperçoit — et seulement s'il y pense.

### Ajouté
`src/lib/crm/timezone.ts` et six tests, dont un sur le jour du changement d'heure et un qui
vérifie que la France et la Belgique donnent bien le même instant.

## [0.8.3] — 2026-10-22 — L'autorisation Google expire au bout de sept jours

### La cause de la panne du jour
L'agenda avait été connecté le 15 octobre. Google révoque les autorisations des
applications en mode **Test** au bout de **sept jours**. Nous étions le 22. Ce n'est pas une
panne de Google : c'est son comportement documenté pour les applications non validées.

### Corrigé
- `invalid_grant` arrive avec un code **400**, pas 401. Il était donc classé comme une
  simple requête invalide et réessayé indéfiniment, alors qu'aucune tentative ne peut
  aboutir. Il est maintenant reconnu avant les codes HTTP, et la connexion est désactivée.
- Nouvel état `EXPIRED`, distinct de `STALE`. « Synchronisation en retard » laissait croire
  que ça reviendrait tout seul. L'écran dit désormais « Autorisation Google expirée » et
  propose « Reconnecter mon agenda ».

### Ce qui n'est pas corrigeable par du code
Le problème se reproduira chez **chaque client, une semaine après chaque connexion**, tant
que l'application Google n'est pas publiée et validée. Voir ADR-028 : c'est un prérequis de
mise en production, et le délai de validation ne se rattrape pas.

## [0.8.2] — 2026-10-22 — Une réponse d'outil doit dire quoi faire ensuite

### Corrigé
- **Sophie appelait le même outil 61 fois dans un seul appel.** L'agenda était considéré
  comme périmé, `check_availability` répondait « les disponibilités ne sont pas
  vérifiables », et le modèle réessayait indéfiniment : rien ne lui disait d'arrêter.
- Les trois sorties non nominales de `check_availability` nomment désormais l'action
  suivante : ne plus appeler cet outil, prendre les préférences du client, enregistrer la
  demande avec `create_lead`.

### Ce que ça coûtait
Au téléphone, une boucle d'outil se paie trois fois : l'appel s'allonge, les crédits
brûlent, et le client entend une machine bloquée. Le mode dégradé avait pourtant bien
fonctionné — Sophie n'a inventé aucun créneau. C'est l'absence d'issue qui manquait, pas la
prudence.

### Garde-fou
`tests/tool-loops.test.ts` vérifie que chaque sortie non nominale dit au modèle d'arrêter
et propose un repli concret. Le texte de ces réponses **est** l'interface avec le modèle :
le modifier sans y penser rouvre la boucle.

### Non résolu
La cause première reste à trouver : l'agenda répondait correctement le matin même. Le
diagnostic est en cours.

## [0.8.1] — 2026-10-22 — Trois messages d'erreur qui disent enfin quoi faire

### Corrigé
- **La région par défaut pointait vers l'Europe.** `.env.example` et l'adaptateur Vapi
  annonçaient `api.eu.vapi.ai`, hérité de l'époque où ADR-020 supposait la région
  européenne accessible. ADR-026 a constaté le contraire le 19 octobre, et ces deux valeurs
  ne l'avaient pas suivi. Une clé américaine envoyée au serveur européen est refusée
  exactement comme une clé fausse — d'où une demi-heure passée à soupçonner la clé.
- **Le rattachement des outils à l'assistant échouait.** Vapi *remplace* l'objet `model`
  au lieu de le fusionner : envoyer seulement `toolIds` efface le modèle et le provider, et
  la requête est refusée. Le script relit désormais l'assistant et renvoie son modèle
  complet.
- **Le script traduisait `401` par « unauthorized ».** Il nomme maintenant les deux causes
  réelles, dans l'ordre de fréquence : la région avant la clé.
- **Le script n'affichait jamais l'adresse du fournisseur**, seulement la nôtre. S'il
  l'avait fait, l'erreur de région se voyait en une seconde.

### Ce que cette série dit
Trois pannes aujourd'hui, trois messages muets. L'en-tête mal nommé, la durée à virgule, la
région périmée : aucune n'était difficile à corriger, toutes ont été difficiles à trouver.
Le coût n'était pas dans le bug, il était dans ce que le programme refusait de dire.

## [0.8.0] — 2026-10-22 — Les outils se déclarent tout seuls

### Le problème
Sophie n'avait qu'un seul outil déclaré chez Vapi. Les sept autres existaient dans le code
mais lui étaient inaccessibles : elle écoutait poliment un client donner son nom et son
adresse, et ne gardait rien. Rien n'apparaissait dans Prospects, et c'était normal.

Les déclarer à la main demande sept formulaires web. C'est long, et c'est surtout ainsi
qu'ils divergent du code : un paramètre renommé d'un côté et pas de l'autre, et Sophie
appelle un outil avec des arguments que le serveur ne comprend plus. L'erreur ne se voit
alors qu'au téléphone.

### Ajouté
- `GET /api/voice/tools/manifest` : le catalogue des outils tel que le serveur les connaît,
  protégé par le secret des webhooks.
- `scripts/sync-vapi-tools.mjs`, via `npm run vapi:tools` : lit ce catalogue et déclare les
  outils chez le fournisseur.

### Deux choix de conception
**Le catalogue est lu depuis le serveur déployé**, pas depuis le code local. Si votre
machine est en avance sur la production, c'est la production qui a raison : c'est elle qui
répondra aux appels.

**Le script n'écrit rien par défaut.** Il faut `--apply`. Un script qui modifie un service
externe dès sa première exécution est un script qu'on lance une fois de trop.

### Ajouté aussi
`SOPHIE_ORG_ID` et `VOICE_ASSISTANT_ID` dans `.env.example`. Elles servent au script local
uniquement et n'ont rien à faire sur Vercel.

## [0.7.3] — 2026-10-22 — Les appels sans numéro visible

### Ajouté
- `save_caller_details` accepte un numéro **dicté** par l'appelant, et Sophie sait le
  demander quand le numéro ne s'affiche pas.
- Une fois le contact identifié, il est rattaché à l'appel : tous les outils suivants le
  retrouvent sans redemander le numéro.

### Pourquoi
Deux situations bien réelles, pas seulement le confort des essais. Un client sur appel
masqué ne pouvait être rattaché à aucune fiche : ni prospect, ni rendez-vous, ni
historique. Et un essai depuis le navigateur n'a jamais de numéro, ce qui rendait la moitié
du produit invérifiable sans acheter une ligne téléphonique.

### Ordre de confiance, inchangé dans son principe
Le contact déjà rattaché à l'appel, puis le numéro venu du réseau, puis seulement le numéro
dicté. Le dernier passe par la reconnaissance vocale : il est le moins sûr, il arrive donc
en dernier.

## [0.7.2] — 2026-10-22 — Un appel se termine vraiment

### Corrigé
- **Les appels restaient « en cours » pour toujours.** Vapi envoie la durée en virgule
  flottante ; la colonne est un entier. PostgreSQL rejetait la mise à jour **entière**, donc
  le statut, la fin et la durée ne s'écrivaient jamais. L'écriture suivante, elle,
  réussissait : la fiche affichait un appel en cours dont l'enregistrement était déjà en
  attente de traitement — un état impossible.
- **`closeCall` jetait le message d'erreur de la base.** C'est ce qui a rendu le bug
  invisible : l'écriture échouait sans que rien ne le signale. L'erreur est maintenant
  journalisée, et la fonction renvoie `null` au lieu de faire comme si tout allait bien.

### Ajouté
- `dureeEnSecondes()` : arrondit, et préfère l'absence à une valeur absurde. Une durée
  fausse dans une statistique est plus difficile à repérer qu'un trou.
- Trois tests, dont un qui vérifie que l'erreur d'écriture n'est plus avalée.

### La leçon
Deux fautes dans le même bug, et la seconde est la pire. Convertir une valeur avant de
l'écrire est une étourderie ordinaire. Ignorer le message d'erreur que la base renvoie
transforme une étourderie en énigme, et c'est un choix qui avait été fait à l'écriture.

## [0.7.1] — 2026-10-22 — Tester sans numéro de téléphone

### Ajouté
- Un essai depuis le navigateur crée désormais un appel dans l'application, à condition que
  l'adresse des événements porte `?org=<uuid>`.

### Pourquoi
Les numéros gratuits de Vapi sont américains. Les appeler depuis la Belgique coûte à
l'opérateur de l'utilisatrice, et un vrai numéro français ou belge demande un K-bis ou un
extrait BCE, un numéro de TVA et environ 72 heures de validation — à faire avant de vendre,
pas avant de tester.

Ce chemin permet de vérifier tout le produit — contacts, prospects, tâches, rendez-vous,
fiche d'appel — sans numéro et sans frais.

### Garde-fou
`is_test` est **forcé** à vrai sur ces appels, et `to_e164` reste nul. Un appel sans numéro
appelé est inatteignable par un vrai client : personne ne compose un numéro qui n'existe
pas. Trois tests verrouillent cette règle, dont un qui vérifie que le chemin normal reste
prioritaire — si celui-ci passait devant, un vrai appel pourrait être marqué comme essai et
disparaître des statistiques.

## [0.7.0] — 2026-10-22 — Sophie sait travailler

> **Écrit, non vérifié.** Rien de cette version n'a été exercé avec un vrai appel.
> `docs/VERIFICATION_PHASE4.md` liste les appels à passer et ce qu'il faut observer.
> Les contrôles automatiques passent, ce qui ne prouve rien : les trois bugs de la semaine
> avaient tous un build vert.

### Ajouté — les outils métier de Sophie
Six outils, qui parlent à la base et non au fournisseur de voix. Ils restent valables si le
fournisseur change.

- `identify_caller` — reconnaît un client à son numéro. Le numéro vient du réseau, jamais
  du modèle : c'est la seule donnée de l'appel qu'on ne peut pas mal entendre.
- `save_caller_details` — nom, adresse, e-mail. N'écrit que les champs réellement fournis :
  un client qui ne redonne pas son adresse ne doit pas la voir effacée.
- `create_lead` — la demande, avec l'urgence si le client l'exprime.
- `create_task` — « rappelez-moi demain matin » devient un rappel daté.
- `create_pending_appointment` — toujours `PENDING_APPROVAL`. Sophie ne confirme jamais à
  la place de l'artisan (section 22). Si la base refuse le créneau, Sophie en propose un
  autre : la prévention des doubles réservations est dans la base, pas dans l'IA.
- `request_human_transfer` — dit la vérité quand aucun transfert n'est possible, plutôt que
  de faire patienter pour rien.

Aucun outil ne permet de confirmer, refuser ou annuler un rendez-vous. Un test interdit
leur apparition : ce serait une régression de principe, pas un ajout de fonctionnalité.

### Ajouté — l'écran des appels
- Liste des appels, et fiche détaillée : qui, quand, combien de temps, le rendez-vous issu
  de l'appel, et le lecteur audio.
- Quand l'audio, la transcription ou le résumé manquent, la fiche **dit pourquoi**. Un bloc
  vide fait croire à une panne.

### Corrigé
- `Number("")` vaut zéro : une durée non renseignée devenait un rendez-vous de zéro minute.
  Trouvé par un test écrit en même temps que le code.
- Deux paramètres d'outil n'avaient pas de description. La description est tout ce que le
  modèle lit pour décider quoi y mettre ; sans elle, il remplit au hasard.

### Pas encore fait
L'audio dans l'espace européen, la transcription, le résumé, et la configuration
automatique de l'assistant depuis les écrans de réglage. Les quatre demandent
`VOICE_API_KEY` sur Vercel.

## [0.6.2] — 2026-10-22 — Premier appel réel, et ce qu'il a appris

**Premier essai vocal réussi.** Sophie a répondu, appelé `check_availability`, et notre
serveur a répondu pendant la conversation. La chaîne complète tient. Deux problèmes relevés
pendant cet essai, corrigés ici.

### Corrigé
- **« Lundi prochain est déjà passé ».** Un modèle de langage n'a pas d'horloge : il
  calculait les dates relatives à partir d'une date imaginaire, souvent celle de son
  entraînement. `check_availability` rappelle maintenant la date du jour dans son message
  d'erreur, et refuse aussi les dates à plus d'un an — presque toujours une erreur d'année.
  La vraie correction est dans les instructions de l'assistant, où la date du jour doit
  être injectée par le fournisseur de voix ; ceci est le filet.

### Ajouté
- `/api/voice/events` : les appels apparaissent enfin dans le produit. Ouverture à la
  sonnerie, fermeture à la fin, programmation des traitements post-appel.
  - Répond toujours 200 sauf sur signature invalide : un code d'erreur ferait réessayer le
    fournisseur, et ses réessais arrivent dans le désordre.
  - Un essai depuis le navigateur n'a pas de numéro appelé et ne crée donc aucun appel.
    C'est voulu : inventer une organisation serait pire que de ne rien enregistrer.
  - Distingue un appel échoué techniquement d'un appel terminé normalement — l'artisan ne
    réagit pas pareil aux deux.

## [0.6.1] — 2026-10-22 — L'organisation peut venir de l'adresse de l'outil

### Ajouté
- `/api/voice/tools` accepte `?org=<uuid>` comme source d'organisation, en plus du numéro
  appelé, de l'appel déjà ouvert et des métadonnées de l'assistant.

### Pourquoi
Un essai depuis le navigateur n'a aucun numéro appelé, et l'interface de Vapi ne laisse plus
modifier les métadonnées de l'assistant à la main. L'adresse du serveur, elle, reste un champ
texte éditable partout. Elle est configurée par nous, pas par le modèle : même niveau de
confiance que les métadonnées, pour une mise en œuvre plus robuste aux changements
d'interface du fournisseur.

L'ordre de résolution reste inchangé : le numéro appelé passe toujours devant, parce que
c'est la seule source vérifiée contre nos propres tables.

## [0.6.0] — 2026-10-20 — Un appel existe dans le produit (Phase 4, début)

### Corrigé — à appliquer avant tout essai téléphonique
- **Les outils de Sophie échouaient systématiquement pendant un appel.** `is_org_member()`
  exigeait un utilisateur connecté ; pendant un appel il n'y en a aucun, c'est le serveur
  qui agit. `check_availability` aurait répondu « impossible de consulter l'agenda » à
  chaque appel. Migration 0020 et ADR-027.

### Ajouté
- Migration 0019 : tables `phone_numbers` et `calls`.
  - `phone_numbers` relie un numéro appelé à une organisation. C'est ce lien qui permet à
    Sophie de savoir chez qui elle travaille (ADR-022 : l'artisan renvoie son numéro vers
    le nôtre).
  - `calls` porte l'appel, avec quatre statuts indépendants — l'appel, l'enregistrement, la
    transcription et le résumé échouent séparément (sections 12 et 16).
  - Aucun droit d'écriture sur `calls` depuis le navigateur : un appel est un fait constaté
    par le fournisseur, jamais une affirmation du client.
- `src/lib/calls/registry.ts` : ouverture et fermeture d'un appel, idempotentes. Un webhook
  rejoué ne crée pas de doublon et ne fait pas revivre un appel terminé.
- `src/lib/sophie/announcement.ts` : construit l'annonce de début d'appel — nature d'IA,
  enregistrement quand il a réellement lieu, et moyen de s'opposer.
- Tests : transitions d'état, garde-fous sur la migration, détection des formulations
  d'annonce insuffisantes, et vérification que les fonctions appelées par le serveur
  acceptent le serveur.

### Modifié
- **La transparence sur la nature d'IA n'est plus désactivable.** `disclose_ai` est
  verrouillée à vrai par contrainte. Article 50 du règlement (UE) 2024/1689, applicable
  depuis le 2 août 2026. Un client ne peut pas désactiver une obligation légale depuis son
  tableau de bord — et c'est nous qui serions en faute de le lui permettre.

### Pas encore fait
La couche qui parle à Vapi n'est pas vérifiée contre un vrai appel. Rien n'est construit
par-dessus tant que l'essai n'a pas eu lieu.

## [0.5.4] — 2026-10-15 — Google Calendar vérifié en conditions réelles

### Modifié
- `google-calendar` passe de `BLOCKED_EXTERNAL_CONFIG` à **`TESTED`**. Exercé contre Google
  le 2026-10-15 : autorisation, jetons, synchronisation, puis vérification par l'usage —
  un événement réel de 10h à 11h a retiré les créneaux de 09:00 à 11:00 des disponibilités
  proposées, marge de 15 minutes comprise.
- `INTEGRATIONS.md` : ce qui a été exercé, ce qui ne l'est pas encore (écriture d'un
  rendez-vous, suppression, webhook — Phase 6), et ce qui manque avant d'ouvrir à des
  clients.

### Note
Pas `PRODUCTION_READY`. L'application Google est en mode Test : seules les adresses
inscrites comme testeurs peuvent connecter un agenda, 100 au maximum. Aucun client réel ne
le pourra avant la validation de l'application par Google.

### Corrigé
- `tests/calendar.test.ts` épinglait l'état `BLOCKED_EXTERNAL_CONFIG` de Google Calendar.
  Un test qui fige un état transitoire oblige à modifier un test chaque fois qu'un travail
  avance — c'est-à-dire qu'il apprend à modifier les tests. Il vérifie désormais ce qui doit
  rester vrai : les variables indispensables sont déclarées, et une intégration bloquée dit
  toujours par quoi.

### Aucun changement de comportement
Cette version ne contient que des corrections d'état et de documentation. Rien ne presse
pour la déployer ; elle peut accompagner la prochaine livraison fonctionnelle.

## [0.5.3] — 2026-10-14 — Connexion Google Calendar réparée

### Corrigé
- **La connexion d'un agenda Google échouait à la dernière étape.** Google acceptait, les
  jetons étaient en main, et l'écriture en base était rejetée : la contrainte d'unicité de
  `calendar_connections` portait sur une expression (`coalesce`), que `ON CONFLICT` ne peut
  pas déduire. Migration 0018 : index sur colonnes simples avec `nulls not distinct`, même
  garantie, cette fois utilisable.
- L'écran affichait « La connexion a échoué » alors que le code connaissait le motif exact.
  Trois motifs distincts sont maintenant transmis et expliqués, avec le geste à faire.
- L'échec « Google n'a pas fourni de jeton de rafraîchissement » n'était pas journalisé.
  Il l'est.

### Ajouté
- `tests/upsert-constraints.test.ts` : pour chaque `onConflict` du code, exige une
  contrainte unique sur colonnes simples dans les migrations. Vérifié dans les deux sens —
  il échoue sur l'état d'avant la migration 0018.
- ADR-025.

### À faire après mise à jour
Appliquer la migration `0018_calendar_connection_upsert.sql` dans Supabase **avant** de
retenter la connexion. Sans elle, le code corrigé échouera de la même façon.

## [0.5.2] — 2026-10-14 — Déploiement débloqué, agenda synchronisé à la demande

### Corrigé
- **Le déploiement de la 0.5.1 était refusé par Vercel.** La tâche planifiée de
  synchronisation d'agenda était réglée sur toutes les quinze minutes ; un compte Hobby
  n'accepte qu'une exécution quotidienne et rejette le déploiement avant la compilation.
  La version 0.5.1 n'a donc jamais pu être mise en ligne, et la connexion Google Calendar
  a semblé absente du produit alors qu'elle était écrite et testée.

### Ajouté
- `ensureCalendarFresh()` : synchronisation de l'agenda au moment où une réponse en dépend
  — ouverture de la page Agenda, et avant tout `check_availability` pendant un appel.
  Ne synchronise que si les données sont périmées, abandonne au bout de six secondes,
  ignore une connexion qui échoue en boucle, ne lève jamais.
- `tests/vercel-config.test.ts` : échoue si `vercel.json` déclare une tâche plus fréquente
  que quotidienne, ou si la région de déploiement quitte l'Europe. Seul contrôle local
  capable d'attraper cette classe d'erreur.
- ADR-024.

### Modifié
- `vercel.json` : tâche planifiée à `0 4 * * *`, une fois par jour.
- `/api/jobs/calendar-sync` : seuil porté à une heure. Ce travail ne garantit plus la
  fraîcheur, il rattrape les connexions que personne n'a consultées.

### Pourquoi ralentir la tâche n'aurait pas suffi
Un agenda est considéré fiable moins de trente minutes après sa dernière lecture. Une
synchronisation quotidienne l'aurait laissé périmé vingt-trois heures sur vingt-quatre, et
Sophie aurait refusé presque tous les rendez-vous sans que rien n'ait l'air cassé.

## [0.5.1] — 2026-10-13 — Domaine zelicall.com

### Modifié
- Le domaine de production devient **zelicall.com**. Aucun changement de code : toutes les
  adresses étaient déjà lues depuis des variables d'environnement, l'ancienne n'apparaissait
  que dans la documentation.
- `DEPLOYMENT.md` : procédure pour relier le domaine à Vercel, et les trois endroits à
  mettre à jour hors du code — `NEXT_PUBLIC_APP_URL`, les redirections Supabase Auth, les
  URI autorisés Google.
- Les URI de redirection Google listent maintenant les deux domaines, pour pouvoir
  continuer à tester si zelicall.com n'est pas encore propagé.
- ADR-023.

### Supprimé
- Un tableau d'URL périmé dans `DEPLOYMENT.md`, hérité de la version 0.1. Il annonçait
  `/api/jobs/run` et `/api/webhooks/voice`, deux adresses qui n'existent pas.

## [0.5.0] — 2026-09-24 — Google Calendar réel et socle de la Phase 4

**État : `TECHNICALLY READY` + `LEGAL REVIEW REQUIRED`.**
Google Calendar et Sophie Voice sont `BLOCKED_EXTERNAL_CONFIG` : le code est écrit, aucun
compte n'existe encore. Voir `src/lib/providers/status.ts`.

### Sécurité — corrigé
- **Les jetons d'agenda étaient lisibles par tout membre connecté.** La migration 0016
  accordait `select` sur toute la table `calendar_connections` à `authenticated`, avec une
  policy ouverte aux membres — alors qu'un commentaire du même fichier affirmait l'inverse.
  La migration 0017 révoque ce privilège et ne réaccorde que les colonnes non sensibles,
  au niveau colonne. Voir ADR-021.
- Les jetons sont désormais chiffrés par l'application en AES-256-GCM, clé hors base
  (`SECRETS_ENCRYPTION_KEY`). Une copie de la base ne suffit plus à les obtenir.
- Chaque connexion, déconnexion et révocation est journalisée dans `audit_logs`.

### Ajouté — Google Calendar
- Migration `0017` : privilèges au niveau colonne, `calendar_busy_blocks`,
  `calendar_sync_state()`, et `available_slots()` qui exclut désormais les occupations
  importées.
- `CalendarProvider` et son implémentation Google, écrite avec `fetch` plutôt qu'avec le
  SDK officiel — celui-ci pèse des dizaines de mégaoctets par fonction serverless.
- Flux OAuth complet : état signé avec HMAC et horodaté, revérification de la session au
  retour, refus d'une connexion sans jeton de rafraîchissement durable.
- Synchronisation incrémentale avec reprise complète automatique quand Google refuse le
  jeton (410), webhook de notification authentifié par jeton de canal, et tâche planifiée
  de rattrapage toutes les quinze minutes.
- Écriture des rendez-vous confirmés dans l'agenda, suppression à l'annulation.
- **Trois états de confiance distincts** : non connecté, connecté et à jour, connecté mais
  périmé. Le troisième est le plus dangereux parce qu'il ressemble au deuxième ; l'interface
  et l'outil `check_availability` le traitent explicitement (sections 19 et 43).
- Si l'écriture vers Google échoue après une confirmation, le rendez-vous reste confirmé
  chez nous, l'écart est visible, et un bouton permet de réessayer. On n'annule pas un
  rendez-vous réel à cause d'une panne d'agenda (section 22).

### Ajouté — socle de la Phase 4
- Les quatre abstractions demandées : `TelephonyProvider`, `VoiceAIProvider`,
  `MessagingProvider`, `TranscriptionProvider`.
- `VapiVoiceProvider` pour la partie testable sans compte : vérification HMAC avec
  protection contre le rejeu, décodage des appels d'outils, mise en forme des réponses.
- Endpoint `/api/voice/tools` et deux outils métier réels : `check_availability` et
  `get_business_information`. Ils valident l'organisation, les données et les règles
  métier côté serveur — Sophie ne produit aucune vérité métier.
- `src/lib/providers/status.ts` : registre des états d'intégration, avec un test qui
  interdit d'annoncer une intégration externe comme `PRODUCTION_READY`.

### Documenté
- **ADR-020** : comparaison argumentée de Vapi et d'OpenAI Realtime sur quatorze critères,
  et choix de Vapi en région européenne. Ce qui tranche n'est pas la quantité de code :
  l'API Realtime en mode SIP exige une WebSocket maintenue pendant tout l'appel, ce que
  les fonctions Vercel ne permettent pas.
- **ADR-021** : chiffrement des jetons d'agenda.
- **ADR-022** : acquisition des numéros de téléphone — **décision ouverte**. Un numéro
  français exige un K-bis, un numéro belge une adresse dans la zone de l'indicatif et un
  numéro de TVA belge. Cela touche le modèle commercial.
- `DEPLOYMENT.md` : étapes exactes de création des comptes Google Cloud et Vapi.
- `LEGAL_COMPLIANCE.md` : contrainte réglementaire sur les numéros, et audit à mener sur
  la chaîne de sous-traitants du fournisseur de voix.

### Corrigé
- Le titre « Equipe » de la page Plus n'avait pas d'accent — reste de la correction
  incomplète de la version 0.2.11, repéré par un avertissement du build.

## [0.4.0] — 2026-09-09 — Phase 3 : agenda et disponibilités

**État : `TECHNICALLY READY` + `LEGAL REVIEW REQUIRED`.**

### Ajouté
- Migration `0015_appointments` : table `appointments` avec les huit états du cycle de vie,
  et surtout **une contrainte d'exclusion PostgreSQL** qui rend la double réservation
  impossible. Deux réservations simultanées : la seconde échoue en base, quelles que
  soient les conditions de course côté application. L'IA n'est jamais le verrou.
- Holds avec expiration, libérés automatiquement avant chaque réservation : un appel
  interrompu ne bloque plus un créneau indéfiniment.
- `book_appointment()` et `set_appointment_status()` : chemin unique de création et de
  changement d'état, traduisant le refus de la contrainte en message compréhensible.
- Migration `0016_availability` : `available_slots()` calcule les créneaux réellement
  libres à partir des horaires, des rendez-vous, des holds, des absences et de la marge
  entre interventions. Rien n'est estimé côté application.
- `calendar_connections` et la vue `calendar_status` : la structure de l'intégration
  Google Calendar, avec les jetons hors de portée du navigateur.
- Écran Agenda : réservation avec choix du créneau parmi les disponibilités réelles,
  rendez-vous groupés par jour, actions selon l'état.
- Le bloc « Aujourd'hui » de l'accueil affiche les vrais rendez-vous du jour.

### Notes
- Google Calendar n'est pas encore branché : il demande un compte Google Cloud et des
  identifiants OAuth. L'écran le dit explicitement plutôt que de laisser croire que les
  créneaux tiennent compte d'un agenda externe.
- Un rendez-vous annulé n'est jamais supprimé (section 21).

## [0.3.2] — 2026-09-09 — Fiche contact, tâches et recherche

Fin de la Phase 2. **État : `TECHNICALLY READY` + `LEGAL REVIEW REQUIRED`.**

### Ajouté
- Fiche contact : identité, appel direct, prospects du client, tâches, coordonnées
  modifiables. La structure de l'historique est celle qui accueillera les appels, les SMS
  et les rendez-vous aux phases suivantes.
- Tâches rattachées à un contact : création avec échéance facultative, case à cocher, mise
  en évidence des retards. Elles alimentent les compteurs de l'accueil.
- Recherche globale sur l'écran Prospects : nom, entreprise, ville, et téléphone normalisé
  — taper quelques chiffres d'un numéro suffit. La recherche passe par la barre d'adresse,
  donc le retour arrière et le rechargement la conservent.
- Lien du prospect vers la fiche de son client.

### Modifié
- Le bloc d'accueil « À traiter » devient « Ce qui presse ». Il portait le même nom qu'une
  étape du pipeline sans recouvrir la même chose, ce qui a réellement induit en erreur :
  un prospect à l'étape « À traiter » n'apparaît pas dans ce bloc, qui ne compte que les
  urgences, les nouveaux prospects et les tâches en retard.
- Un contact complété à la main cesse d'être marqué provisoire.

## [0.3.1] — 2026-09-09 — Lisibilité du bloc « À traiter »

### Corrigé
- Un résultat vide de `dashboard_counts()` était traité comme un succès à zéro : un échec
  silencieux s'affichait donc en « Rien ne vous attend » rassurant. Il est désormais
  signalé comme une erreur.
- L'accueil porte explicitement `force-dynamic` au lieu de dépendre de l'héritage du
  layout.

### Modifié
- Quand rien ne demande d'action mais que des prospects sont en cours, l'accueil le dit et
  propose d'y aller. Auparavant, un artisan venant de créer un prospect ne voyait aucune
  trace de son action : le bloc ne compte que les urgences, les nouveaux prospects et les
  tâches en retard.

## [0.3.0] — 2026-09-08 — Phase 2 : CRM

**État : `TECHNICALLY READY` + `LEGAL REVIEW REQUIRED`.**

### Ajouté
- Migration `0013_crm` : `contacts`, `leads`, `tasks`, avec RLS, privilèges et index.
  Déduplication des contacts par téléphone normalisé — index unique en base, pas seulement
  une vérification applicative.
- Migration `0014_crm_search` : `search_crm()` (nom, entreprise, ville, et téléphone
  normalisé), `dashboard_counts()` (compteurs de l'accueil, calculés dans le fuseau de
  l'entreprise), `find_contact_by_phone()` — la fonction que Sophie utilisera en Phase 4,
  exposée dès maintenant pour être éprouvée avant que de vrais appels en dépendent.
- Pipeline `NEW → QUALIFIED → APPOINTMENT → CUSTOMER → WON | LOST`, avec transitions
  contrôlées **côté serveur** : un bouton masqué n'est pas une protection. Rouvrir un
  prospect perdu est permis, c'est fréquent et légitime.
- Écran Prospects avec filtres (en cours, urgents, nouveaux, tous), création d'un prospect
  qui crée ou retrouve le contact, fiche prospect avec appel direct et changement d'étape.
- Le bloc « À traiter » de l'accueil affiche enfin de vrais compteurs : urgences, nouveaux
  prospects, tâches en retard — chacun cliquable vers la liste filtrée.
- Tests du pipeline, des transitions, des tâches en retard et du nom affichable.

### Notes
- Les tâches ont leur table et leurs compteurs ; leur interface arrive avec la fiche
  contact.
- L'accueil renvoie des compteurs à zéro plutôt que de planter si la requête échoue :
  c'est le premier écran ouvert, il doit toujours s'afficher.

## [0.2.12] — 2026-09-08 — Installation PWA et passe de design

### Ajouté
- Bouton d'installation dans l'en-tête. Sur Android il déclenche l'invite native ; sur
  iPhone, où aucune API n'existe, il explique le geste (Partager → Sur l'écran d'accueil).
  Il disparaît une fois l'application installée. Ce n'est pas un confort : sur iOS, les
  notifications d'une application web ne fonctionnent que si elle a été installée, et
  « rendez-vous à valider » est le cœur du produit.
- Icônes dans la navigation basse : un texte se lit, une icône se reconnaît.

### Modifié
- Palette revue. Le fond passe du blanc à un gris-vert très pâle : le blanc pur éblouit en
  plein soleil, là où l'artisan regarde son téléphone. Vert plus profond et plus saturé.
- Hiérarchie visuelle par **arête de statut** : une bande de couleur à gauche des blocs qui
  demandent une action, rien pour les autres. Remplace des cartes toutes identiques, où
  « Configuration de Sophie » et « Rien ne vous attend » avaient le même poids.
- États vides en pointillés et en gris : ils informent, ils ne réclament pas.
- Deux rayons de bordure au lieu d'un seul, selon le rôle de la surface.

## [0.2.11] — 2026-09-08 — Orthographe de l'interface

### Corrigé
- Les accents manquaient dans tous les textes visibles : « prete », « repond », « regles »,
  « taches », « Creer mon compte », « Se deconnecter », « Proprietaire », « Etape »,
  « equipe », « parametres », et les messages d'erreur des actions serveur. Héritage de
  mon écriture du SQL sans accents, qui avait débordé dans l'interface.
- Reformulation de « {n} % termine » en « {n} % de la configuration est fait », plus clair.

### Notes
- Les occurrences restantes sont des commentaires de code, des chemins de route
  (`/onboarding/metier`) et un nom d'option HTML : elles ne sont pas visibles par
  l'utilisateur et ne doivent pas être touchées.

## [0.2.10] — 2026-09-08 — Correctif : export interdit dans une action serveur

### Corrigé
- `src/app/onboarding/actions.ts` exportait `SUPPORTED_COUNTRIES`, un objet. Un fichier
  `"use server"` ne peut exporter que des fonctions asynchrones : Next levait
  « A "use server" file can only export async functions » **au moment de soumettre le
  formulaire**, pas au build. C'était la cause réelle de l'erreur après la saisie du nom
  de l'entreprise, et ce qui empêchait `set_onboarding_step()` de s'exécuter.
- L'objet n'était utilisé nulle part ; il est supprimé.

### Ajouté
- `tests/server-actions.test.ts` : vérifie que tout fichier `"use server"` n'exporte que
  des fonctions asynchrones ou des types. Ce défaut passait le build et le typecheck sans
  broncher, il n'apparaissait qu'au clic de l'utilisateur.

## [0.2.9] — 2026-09-08 — Correctif : boucle de redirection dans l'onboarding

### Corrigé
- `/onboarding` redirigeait vers la route de l'étape courante. Quand cette étape était
  encore `ORGANIZATION`, cette route **était cette page elle-même** : boucle infinie,
  transformée par Next en « Application error » après la création de l'entreprise. Une
  page ne se redirige plus jamais vers elle-même, ni dans la page ni dans la garde d'étape.
- L'échec de `set_onboarding_step()` était ignoré silencieusement, ce qui laissait
  l'onboarding bloqué à la première étape sans message. Il est désormais signalé.
- Test de régression : aucune étape ne partage sa route avec une autre.

## [0.2.8] — 2026-09-08 — Correctif : variables facultatives en production

### Corrigé
- L'application échouait en production avec « Configuration incomplete :
  NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_APP_ENV » alors que ces deux variables ont une valeur
  par défaut et que tout fonctionnait en développement.

  Cause : Next.js remplace les variables `NEXT_PUBLIC_` au moment du build. Une variable
  absente devient une **chaîne vide**, pas `undefined` — or `.default()` de zod ne
  s'applique qu'à `undefined`. La chaîne vide était donc validée, et rejetée. En
  développement, `process.env` étant lu à l'exécution, le problème n'apparaissait pas.

  Les valeurs vides sont désormais converties en `undefined` avant validation.
- Test de régression ajouté.

## [0.2.7] — 2026-09-08 — Sonde de connectivite Supabase

### Ajouté
- `/api/health/supabase` : exerce réellement le chemin utilisé par les pages — création du
  client, lecture de session, requête sur une table protégée par RLS — et renvoie le
  message d'erreur exact de chaque étape. Transforme un « Application error » opaque en
  diagnostic lisible, sans exposer aucune valeur secrète.

### Corrigé
- `/api/health` affichait `environment: ""` : `??` ne rattrape pas la chaîne vide, `||` si.

## [0.2.6] — 2026-09-08 — Diagnostic de configuration

### Corrigé
- `/onboarding` renvoyait vers `/app` au lieu de reprendre l'onboarding à l'étape en
  cours : une modification de la Phase 1 n'avait pas été appliquée. Le build le signalait
  par un avertissement `'STEP_ROUTES' is defined but never used`, passé inaperçu.
- `/api/health` affichait toujours `version: 0.1.0` et `environment: ""` : la version est
  désormais lue depuis `package.json`, et l'environnement indique `non defini` plutôt
  qu'une chaîne vide trompeuse. Ces deux valeurs m'avaient conduit à un faux diagnostic.

### Ajouté
- `/api/health` indique quelles variables d'environnement sont présentes — jamais leur
  valeur — et renvoie 503 si l'une manque.
- Le middleware affiche un message lisible nommant les variables manquantes, au lieu de
  laisser une exception opaque « Application error ».

## [0.2.5] — 2026-09-08 — Isolation multi-tenant vérifiée

Pas de changement de code. Cette entrée consigne un jalon.

### Vérifié
- La suite d'isolation multi-tenant s'est exécutée pour la première fois contre une vraie
  base Supabase : 50 tests passés, aucun ignoré. L'isolation entre organisations est
  désormais prouvée, et non plus seulement conçue.
- Les douze migrations sont appliquées et confirmées par les scripts de vérification.

### Notes
- Reste ouvert : `src/types/database.ts` est encore écrit à la main et doit être régénéré
  depuis le schéma réel (ADR-012).

## [0.2.4] — 2026-09-08 — Correctif : privilèges de table manquants

**Bug révélé par la première exécution réelle des tests d'isolation.**

### Corrigé
- Migration `0012_table_grants` : les policies RLS existaient, mais les `GRANT` au niveau
  des tables manquaient. Postgres vérifie le privilège **avant** la policy — résultat,
  `permission denied for table organizations` pour tout utilisateur connecté, y compris
  sur ses propres données. Nous nous reposions sur les privilèges par défaut de Supabase,
  qui ne se sont pas appliqués. Chaque privilège est désormais déclaré explicitement, et
  les privilèges par défaut sont fixés pour les tables futures.
- Le test « s'ajouter comme membre d'un autre tenant est refusé » passait pour la mauvaise
  raison : il attendait le code `42501`, que renvoient aussi bien un refus RLS qu'un
  privilège manquant. Il vérifie maintenant que le refus vient bien de RLS.

### Ajouté
- Quatre contrôles **positifs** dans la suite d'isolation : un membre lit bien sa propre
  organisation, sa propre équipe, ses activités et le catalogue des métiers. Sans eux, une
  base totalement verrouillée ressemblait à un succès — tous les contrôles négatifs
  passaient, pour la mauvaise raison.
- `01_verify_schema.sql` détecte les tables ayant des policies mais aucun privilège.

## [0.2.3] — 2026-09-08 — Chargement fiable de la configuration de test

### Corrigé
- Les variables de `.env.local` étaient injectées dans `process.env` depuis le fichier de
  configuration Vitest. Or les tests s'exécutent dans des processus séparés : la mutation
  ne leur parvenait pas de façon fiable, et la suite d'isolation se marquait « ignorée »
  malgré une configuration correcte. Elles passent désormais par `test.env`.

### Ajouté
- `npm run check:env` : diagnostic de `.env.local` — encodage UTF-16, BOM, espaces autour
  du signe égal, guillemets, clés absentes ou trop courtes. N'affiche jamais la valeur
  d'une clé, seulement son nom et sa longueur.

## [0.2.2] — 2026-09-08 — Correctif : configuration des tests

### Corrigé
- Vitest ne lit pas `.env.local` (contrairement à Next.js). Les variables
  `SUPABASE_TEST_*` étaient donc invisibles pour la suite d'isolation, qui se marquait
  « ignorée » alors que la configuration était présente — un faux négatif silencieux sur
  un contrôle de sécurité. `vitest.config.ts` charge désormais explicitement le fichier.
- Message plus explicite quand la suite est réellement non configurée.

### Ajouté
- `tests/env-loading.test.ts` : vérifie que les variables déclarées dans `.env.local`
  arrivent bien dans `process.env`.

## [0.2.1] — 2026-09-07 — Scripts de vérification

### Ajouté
- `supabase/checks/01_verify_schema.sql` : contrôle en lecture seule des tables, fonctions
  et colonnes attendues, avec le numéro de migration pour chaque objet manquant. Détecte
  aussi les tables sans RLS et les tables avec RLS mais sans policy.
- `supabase/checks/02_verify_content.sql` : catalogue de métiers, modèles d'annonce,
  garde-fous de conformité.
- `supabase/checks/README.md` : lecture des résultats et ordre d'application.

## [0.2.0] — 2026-09-07 — Phase 1 : entreprise et Sophie

**État : `TECHNICALLY READY` + `LEGAL REVIEW REQUIRED`.**

### Ajouté
- Migration `0009_profession_templates` : modèles de métier avec services suggérés,
  questions de qualification, catégories d'urgence, vocabulaire et durées. Catalogue de
  douze métiers, dont « Autre » avec saisie libre. Modifiable depuis la console plateforme.
- Migration `0010_business_configuration` : `business_profiles`, `services`,
  `business_hours`, `absences`, avec RLS et normalisation du téléphone.
- Migration `0011_sophie_configuration` : `sophie_configurations`, `business_knowledge`,
  fonctions `apply_profession_template()` et `set_onboarding_step()`.
- Onboarding complet en sept étapes, sauvegardé au fur et à mesure et reprenable :
  entreprise, métier, services, horaires, agenda, Sophie, appels.
- Garde d'étape : on revient en arrière librement, on ne saute pas en avant. L'organisation
  fait foi, jamais l'URL.
- Éditeur de services : activation, durée, ajout personnalisé, indication de prix en texte.
- Éditeur d'horaires : sept jours, durée standard, marge entre interventions.
- Configuration de Sophie : nom, ton, phrase d'accueil, consignes, transparence sur sa
  nature d'assistante virtuelle.
- Règles de prise d'appel avec numéro de transfert.
- Accueil : reprise de la configuration, message adapté une fois terminée.
- Tests : validation des horaires, cohérence du parcours d'onboarding.

### Notes
- L'étape agenda annonce honnêtement que Google Calendar arrive en Phase 3 plutôt que
  d'afficher un bouton qui ne connecte rien.
- `sophie_configurations.is_active` reste faux : la prise d'appel réelle demande la
  Phase 4.
- Les services issus d'un modèle de métier sont remplacés si l'on change de métier ; ceux
  ajoutés par l'entreprise sont conservés.

## [0.1.5] — 2026-09-07 — Région d'exécution européenne

### Ajouté
- `vercel.json` : `"regions": ["fra1"]`. Le projet s'exécutait à `iad1` (Washington), donc
  hors UE, ce qui contredisait l'engagement du registre des sous-traitants (L2).
- `DEPLOYMENT.md` : tableau des réglages Vercel à vérifier, diagnostic du taux d'erreur
  à 100 %.

### Modifié
- `LEGAL_COMPLIANCE.md` : entrée Vercel du registre mise à jour avec le constat et la
  correction ; le cas du middleware en périphérie est consigné comme point ouvert.

## [0.1.4] — 2026-09-07 — Correctif de déploiement

### Corrigé
- Le build échouait au prérendu des pages sous `(app)` lorsque les variables
  d'environnement Supabase étaient absentes. Ces pages dépendent de la session et ne
  doivent jamais être prérendues : `export const dynamic = "force-dynamic"` est ajouté sur
  le layout `(app)`, la page racine et l'onboarding. Le build passe désormais sans aucune
  variable d'environnement.
- Message d'erreur de configuration : il indique maintenant quoi faire sur Vercel, et
  rappelle qu'une variable `NEXT_PUBLIC_` exige un nouveau déploiement.

### Modifié
- `engines.node` passe de `>=20.9.0` à `22.x` : une plage ouverte laissait Vercel changer
  de version majeure sans préavis.
- `DEPLOYMENT.md` : section de dépannage.

## [0.1.3] — 2026-09-07 — Organisations d'essai

**État : `TECHNICALLY READY` + `LEGAL REVIEW REQUIRED`.**

### Ajouté
- Migration `0008_test_organizations` : `is_test_organization` sur `organizations`, faux
  par défaut, avec traçabilité de l'activation.
- Trigger réservant la bascule en mode test à l'administration de la plateforme.
- Fonction `call_is_test(org_id, requested_test)` : seule qualification faisant foi.
- Section « Faire ses propres essais d'enregistrement » dans `LEGAL_COMPLIANCE.md`.
- ADR-019.
- Tests : le drapeau de test est ignoré hors organisation d'essai ; un propriétaire ne
  peut pas basculer son organisation en mode test.

### Modifié
- `recording_allowed()` : un appel de test n'est reconnu que dans une organisation
  d'essai. Ailleurs, le drapeau est ignoré et l'annonce validée reste obligatoire.

### Sécurité
- Le mode test passe d'une convention déclarative à une garantie de la base.

## [0.1.2] — 2026-09-07 — Cadre de conformité

**État : `TECHNICALLY READY` + `LEGAL REVIEW REQUIRED`.** Pas `PRODUCTION READY`.

### Ajouté
- `docs/LEGAL_COMPLIANCE.md` : définition des trois états de maturité,
  `PRE_PRODUCTION_LEGAL_CHECKLIST` (L1 à L12), checklist des clauses du DPA à faire
  rédiger, registre des fournisseurs et sous-traitants ultérieurs, qualification du rôle
  de Sophie IA par traitement, état des durées de conservation.
- Migration `0007_recording_notice_templates` : textes d'annonce par pays et par langue,
  `is_legally_validated` faux par défaut, traçabilité de la validation, résolution par
  `resolve_recording_notice()`.
- Fonction `recording_allowed(org_id, is_test)` : refuse **en base** l'enregistrement d'un
  appel réel si l'annonce applicable n'est pas validée. Les appels de test restent permis.
- `isRealRecordingAllowed()` et `recordingBlockers()` côté application, avec tests.
- ADR-015 à ADR-018.

### Modifié
- Le texte d'annonce du code est explicitement marqué `NON VALIDÉ JURIDIQUEMENT` et n'est
  plus qu'un secours de développement.
- `ROADMAP.md` : tableau des portes juridiques et états de maturité par livraison.
- `CLAUDE_HANDOFF.md` : état de maturité en tête de document, décisions ouvertes listées.

### Notes
- Les durées de conservation autres que l'audio restent une décision ouverte (ADR-018).
  Aucune valeur ne sera inventée.
- La région d'hébergement des fournisseurs de téléphonie, de voix et d'IA est inconnue
  tant qu'ils ne sont pas choisis (ADR-017).

## [0.1.1] — 2026-09-07 — Politique d'enregistrement

Amendement de la Phase 0 après décision produit : lancement France et Belgique, audio
conservé 30 jours maximum.

### Ajouté
- Migration `0006_audio_retention_policy` : `recording_enabled`, `audio_retention_days`
  (plafonné à 30 par contrainte), `recording_notice_required`, `recording_notice_text`,
  `recording_policy_accepted_at` sur `organizations`.
- Contrainte empêchant d'activer l'enregistrement sans acceptation préalable de la charte.
- Table `audio_retention_events` : preuve de purge, lisible par l'entreprise concernée,
  écriture réservée au serveur.
- `src/lib/org/recording.ts` et ses tests.
- Section « Enregistrement des appels — France et Belgique » dans `SECURITY.md`.
- ADR-013 (rétention 30 jours) et ADR-014 (deux pays au lancement).

### Modifié
- L'onboarding ne propose plus que la France et la Belgique.
- `PRODUCT_SPEC.md` : la question du pays et de l'enregistrement est tranchée.

### Sécurité
- L'enregistrement est désactivé par défaut.
- Le plafond de 30 jours est appliqué en base, pas par le code applicatif.

## [0.1.0] — 2026-09-07 — Phase 0, fondations

### Ajouté
- Projet Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind CSS 4.
- Cinq migrations Supabase : extensions et fonctions utilitaires, identité et
  multi-tenant, activités et audit, fonctions d'autorisation, policies RLS.
- Tables `profiles`, `organizations`, `organization_members`,
  `organization_invitations`, `activities`, `audit_logs`.
- Fonctions `is_org_member`, `org_role`, `has_org_role`, `is_platform_admin`,
  `my_organizations`, `create_organization`.
- RLS activé sur toutes les tables publiques, avec une policy par opération.
- Trois clients Supabase séparés : navigateur, serveur, administration
  (`server-only`).
- Authentification e-mail et mot de passe : inscription, connexion, déconnexion,
  route de callback protégée contre l'open redirect.
- Middleware de rafraîchissement de session et de protection des routes.
- Première étape d'onboarding réellement fonctionnelle : création de l'entreprise.
- Coquille de l'application mobile : en-tête avec l'état de Sophie, navigation basse à
  cinq entrées, écrans Accueil, Prospects, Agenda, Appels, Sophie et Plus.
- Page Plus fonctionnelle : entreprise, équipe lue sous RLS, rôle, déconnexion.
- Design system : jetons de couleur et de typographie, composants Button, Field, Input,
  Sheet, et les quatre états chargement / vide / erreur / succès.
- PWA : manifeste, icônes, couleur de thème, zones sûres iOS.
- Tests : permissions RBAC, progression d'onboarding, et suite d'isolation multi-tenant
  contre une vraie base (ignorée si non configurée).
- Quatorze documents de mémoire du projet.
- Script `release:zip` produisant une archive complète de la version.

### Sécurité
- `is_platform_admin` non modifiable par l'utilisateur.
- Message d'erreur d'authentification indifférencié.
- En-têtes de sécurité HTTP.
- Trigger empêchant la suppression du dernier propriétaire d'une organisation.

### Notes
- Sophie ne répond pas encore au téléphone : la téléphonie arrive en Phase 4.
- Aucune clé externe n'est requise à ce stade, en dehors de Supabase.
