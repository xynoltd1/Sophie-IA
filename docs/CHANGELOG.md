# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Versionnement sémantique.

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
