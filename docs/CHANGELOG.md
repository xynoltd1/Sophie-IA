# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Versionnement sémantique.

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
