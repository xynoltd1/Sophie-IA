# Reprise du projet

> Ce document est le point d'entrée d'une nouvelle session. Lisez-le en premier, puis
> `PROJECT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `LEGAL_COMPLIANCE.md`, `CHANGELOG.md`.
> **Le code et les tests font foi.** Si ce document et le code divergent, vérifiez le code,
> corrigez ce document, et signalez l'écart.

---

## Où en est le projet

**Version** 0.10.1 · **Phase 4 vérifiée en essai navigateur ; aucun appel sur un vrai numéro** · **Vérifié le 2026-10-23**

**État de maturité : `TECHNICALLY READY` + `LEGAL REVIEW REQUIRED`.**
Pas `PRODUCTION READY` : la `PRE_PRODUCTION_LEGAL_CHECKLIST` de
`docs/LEGAL_COMPLIANCE.md` n'est pas validée. Aucun client réel tant qu'elle ne l'est pas.
Le développement technique continue normalement.

### Le scénario du cahier des charges, section 63 : où il en est

| Étape | État |
|---|---|
| L'artisan configure entreprise, métier, services, horaires | ✅ vérifié |
| Il connecte son agenda Google | ✅ vérifié par un événement réel le 2026-10-15 |
| Un client appelle, Sophie répond en français | ✅ vérifié le 2026-10-22 |
| Elle comprend, identifie ou crée le contact | ✅ vérifié |
| Elle vérifie les **vraies** disponibilités et propose un créneau | ✅ vérifié |
| Le créneau est bloqué, le rendez-vous apparaît « À valider » | ✅ vérifié |
| L'artisan est alerté sur l'accueil | ✅ depuis 0.10.0 |
| L'audio est conservé dans notre espace européen | ❌ Phase 5 |
| Transcription, résumé, extraction | ❌ Phase 5 |
| Il accepte, l'agenda Google est mis à jour | ⚠️ code en place, **non vérifié avec un vrai rendez-vous** |
| Le client reçoit un SMS | ❌ Phase 6 |

Le point le plus trompeur de ce tableau est l'avant-dernier : `pushAppointment()` dans
`src/app/(app)/app/agenda/actions.ts` est écrit et appelé à l'acceptation d'un rendez-vous,
mais aucun rendez-vous réel n'est passé par ce chemin. Il doit être vérifié avant d'être
compté comme acquis.

### Vérifications passées, exécutées le 2026-10-22

```
npm run typecheck   ✓
npm run lint        ✓
npm run test        ✓  183 tests passés, 17 ignorés (SUPABASE_TEST_* non renseignées ici)
npm run build       ✓
```

**Ces quatre contrôles ne suffisent pas.** La version 0.5.1 les passait tous et son
déploiement a pourtant été refusé par Vercel : la tâche planifiée était trop fréquente pour
un compte Hobby, règle appliquée avant la compilation (ADR-024). `tests/vercel-config.test.ts`
couvre ce cas. Avant d'annoncer une version livrable, **vérifier qu'un déploiement réel est
passé**, pas seulement que le build est vert en local.

Les 17 tests ignorés sont la suite d'isolation multi-tenant et un contrôle de
configuration. Ils **ont tourné avec succès contre la vraie base le 2026-09-08** ; ils
s'ignorent seulement quand les variables `SUPABASE_TEST_*` sont absentes de `.env.local`.

## Ce qui fonctionne réellement

**Fondations (Phase 0)**
- Authentification e-mail et mot de passe : inscription, connexion, déconnexion, callback
  protégé contre l'open redirect.
- Multi-tenant : `create_organization()`, appartenance `OWNER` automatique, RLS active
  partout, **prouvée par les tests contre la vraie base**.
- Session : `getSessionContext()`, `requireSession()`, `requireOrganization()`.
  L'organisation active est en cookie, toujours confrontée à `my_organizations()`.
- Design system, PWA (manifeste, icônes, bouton d'installation Android et iPhone),
  sondes `/api/health` et `/api/health/supabase`.

**Entreprise et Sophie (Phase 1)**
- Onboarding complet en sept étapes, sauvegardé à chaque étape, reprenable, avec garde
  d'étape côté serveur.
- Catalogue de douze métiers ; `apply_profession_template()` crée profil, services,
  horaires et configuration Sophie en une transaction.
- Configuration de Sophie : nom, ton, accueil, consignes, transparence sur sa nature.
- Règles de prise d'appel avec numéro de transfert.

**CRM (Phase 2)**
- Contacts avec déduplication par téléphone normalisé (index unique en base).
- Prospects, pipeline `NEW → QUALIFIED → APPOINTMENT → CUSTOMER → WON | LOST`,
  transitions vérifiées côté serveur.
- Tâches rattachées à un contact, échéances, retards.
- Fiche contact : appel direct, prospects, tâches, coordonnées éditables.
- Recherche globale (nom, entreprise, ville, téléphone normalisé), portée par l'URL.
- Accueil : bloc « Ce qui presse » alimenté par `dashboard_counts()`.

**Agenda (Phase 3, sauf Google Calendar)**
- `appointments` avec les huit états du cycle de vie.
- **Contrainte d'exclusion GiST** : deux rendez-vous actifs ne peuvent pas se chevaucher.
  La seconde réservation simultanée échoue en base. L'IA n'est jamais le verrou.
- Holds avec expiration, libérés avant chaque réservation.
- `available_slots()` calcule les créneaux réellement libres (horaires, rendez-vous,
  holds, absences, marge).
- Écran Agenda : réservation par choix de créneau réel, regroupement par jour, actions
  selon l'état. Bloc « Aujourd'hui » de l'accueil alimenté.

**Téléphonie et Sophie Voice (Phase 4)**
- `phone_numbers` fait le lien numéro appelé → organisation. L'artisan garde son numéro et
  le renvoie vers le nôtre (ADR-022).
- `calls` avec six états et trois statuts de traitement indépendants.
- Huit outils métier servis par `/api/voice/tools`, signature vérifiée avant lecture du
  corps ; une erreur métier revient en HTTP 200 avec une phrase que Sophie peut prononcer.
- `npm run vapi:tools` synchronise les outils et les rattache à l'assistant.
- Vérifié par un appel réel le 2026-10-22 : contact créé, demande urgente enregistrée,
  rendez-vous « À valider » dans l'agenda.
- Accueil : rendez-vous à valider, appels à rappeler et appels échoués (0.10.0). Un appel
  dont rien n'est sorti est la seule perte qui était invisible ; elle ne l'est plus.

## Ce qui est écrit mais jamais exercé

Le registre `src/lib/providers/status.ts` fait foi. Un test interdit d'y déclarer une
intégration externe `PRODUCTION_READY`.

| Élément | État | Ce qui manque |
|---|---|---|
| Écriture d'un rendez-vous confirmé dans Google Calendar | code en place, jamais exercé | accepter un vrai rendez-vous « À valider » et vérifier l'événement dans l'agenda |
| Audio, transcription, résumé | non commencé | `VOICE_API_KEY` sur Vercel, puis Phase 5 |
| Provisionnement automatique de l'assistant Vapi | script écrit (`npm run vapi:tools`) | exercé en local uniquement ; dépend de `VOICE_API_KEY` |

**Vérifié depuis, et acquis :** OAuth Google et disponibilités réelles (2026-10-15),
Sophie Voice sur un vrai numéro avec outils métier (2026-10-22).

## Ce qui est partiel

| Élément | État |
|---|---|
| Déclaration d'un numéro de téléphone | **aucun écran, aucun script** : `phone_numbers` s'écrit en SQL à la main. Tant que la table est vide, `openCall()` renvoie `null` et un appel réel ne crée aucune ligne. Tous les appels passent par le repli `openTestCall()` et sont marqués `is_test` |
| Transcription en français | qualité insuffisante avec Soniox : « Tongeren » → « Tangerine », numéro tronqué. Deepgram et Google restent à comparer. Aucun classement public francophone n'existe (`docs/VOICE_PROVIDERS.md`) |
| Sophie coupe la parole | réglages du *Start/Stop Speaking Plan* identifiés, à appliquer et retester |
| Écran Sophie | l'écran *Sophie → Connaissances* reste à faire (la table `business_knowledge` existe) |
| Paramètres | pas d'édition des services et horaires après l'onboarding ; pas de gestion des absences |
| `src/types/database.ts` | écrit à la main (ADR-012), à régénérer depuis le schéma réel |
| Application Google | en mode **Test** : les autorisations sont révoquées au bout de 7 jours (ADR-028). Prérequis de mise en production |

## Ce qui n'est pas commencé

Enregistrement audio dans le bucket privé, lecteur alimenté par un vrai fichier,
transcription, résumé, extraction structurée, jobs asynchrones et reprises, SMS,
notifications, console plateforme, abonnements et usage, observabilité.

## Architecture en trois phrases

Next.js App Router sur Vercel, sans back-end séparé (ADR-001). L'isolation des clients
repose sur RLS PostgreSQL, pas sur des filtres applicatifs (ADR-003). Le flux audio d'un
appel **ne passe jamais par Vercel** : notre application n'expose que des outils HTTP
appelés pendant la conversation (ADR-002) — c'est la contrainte la plus structurante du
projet, et le premier critère de choix du fournisseur de voix.

## Migrations — vingt-deux

```
0001_extensions_and_helpers      extensions, set_updated_at, normalize_phone, slugify
0002_core_identity               profiles, organizations, organization_members, invitations
0003_activity_and_audit          activities (lisible par le tenant), audit_logs (jamais)
0004_authorization_functions     is_org_member, org_role, has_org_role, my_organizations,
                                 create_organization
0005_rls_policies                RLS + une policy par opération
0006_audio_retention_policy      enregistrement désactivé par défaut, rétention audio
                                 plafonnée à 30 jours en base, preuve de purge
0007_recording_notice_templates  annonces par pays et langue, non validées par défaut ;
                                 recording_allowed() bloque l'enregistrement réel
0008_test_organizations          is_test_organization ; call_is_test() fait foi
0009_profession_templates        modèles de métier + catalogue de douze métiers
0010_business_configuration      business_profiles, services, business_hours, absences
0011_sophie_configuration        sophie_configurations, business_knowledge,
                                 apply_profession_template(), set_onboarding_step()
0012_table_grants                privilèges de table (bug trouvé par les tests)
0013_crm                         contacts (déduplication téléphone), leads, tasks
0014_crm_search                  search_crm(), dashboard_counts(), find_contact_by_phone()
0015_appointments                appointments + contrainte d'exclusion anti-doublon,
                                 book_appointment(), set_appointment_status()
0016_availability                available_slots(), appointments_for_day(),
                                 calendar_connections, vue calendar_status
0017_calendar_security_and_sync  privileges colonne sur les jetons, calendar_busy_blocks,
                                 calendar_sync_state(), available_slots() avec agenda externe
0018_calendar_connection_upsert  unicite sur colonnes nues pour l'upsert d'agenda (ADR-025)
0019_calls_and_numbers           phone_numbers, calls, statuts de traitement independants,
                                 organization_for_number(), disclose_ai verrouille a true
0020_server_context              is_server_context() : le serveur n'est pas un utilisateur
                                 (ADR-027)
0021_phone_origin                contacts.phone_origin : reseau, dicte ou saisi
0022_call_links                  call_id sur leads, appointments, tasks ;
                                 dashboard_counts compte les rendez-vous a valider,
                                 les appels sans suite et les appels echoues
```

`supabase/checks/01_verify_schema.sql` et `02_verify_content.sql` vérifient l'état du
schéma en lecture seule. Les lancer après toute nouvelle migration.

**Règle absolue** : toute nouvelle table portant un `organization_id` reçoit RLS, ses
policies, **son `GRANT` à `authenticated`** et son index `(organization_id, …)` dans la
même migration. Une table sans policy est une fuite de données ; une table sans `GRANT`
est inaccessible même à son propriétaire — les deux erreurs se sont produites, la seconde
a été trouvée par les tests.

**Écrire des contrôles positifs autant que négatifs.** La suite d'isolation ne contenait
que des assertions « X ne doit pas voir Y ». Une base entièrement verrouillée les faisait
toutes passer. Quatre contrôles positifs ont été ajoutés ; garder ce réflexe.

## Variables d'environnement

Requises aujourd'hui : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`. Pour lancer la suite d'isolation : `SUPABASE_TEST_URL`,
`SUPABASE_TEST_ANON_KEY`, `SUPABASE_TEST_SERVICE_ROLE_KEY` dans `.env.local`, **jamais sur
Vercel**. `npm run check:env` diagnostique le fichier sans afficher aucune valeur.

Les variables des phases suivantes sont déclarées dans `.env.example`, groupées par phase,
et pas encore utilisées.

---

## Décisions importantes déjà prises

Voir `DECISIONS.md` pour le détail (ADR-001 à ADR-019). Celles à connaître avant de
toucher au code :

- **ADR-002** — la voix ne transite pas par Vercel ; `SophieEngine` est un ensemble
  d'endpoints HTTP courts, pas un processus.
- **ADR-003** — l'isolation est dans la base, pas dans le code.
- **ADR-004** — les fonctions d'autorisation sont `SECURITY DEFINER` pour éviter la
  récursion RLS ; `search_path` figé, filtrage sur `auth.uid()`.
- **ADR-005** — `organizations` n'a **aucune** policy INSERT ; la création passe par
  `create_organization()`.
- **ADR-013** — l'audio est conservé **30 jours maximum**, plafond appliqué par une
  contrainte en base ; la transcription et le résumé survivent à la purge.
- **ADR-014** — lancement limité à la France et à la Belgique.
- **ADR-015** — le texte d'annonce est une donnée, non validée par défaut ; le blocage de
  l'enregistrement réel est en base.
- **ADR-016** — trois états : `TECHNICALLY READY`, `LEGAL REVIEW REQUIRED`,
  `PRODUCTION READY`. Chaque livraison annonce le sien.
- **ADR-018** — les durées de conservation autres que l'audio sont une **décision
  ouverte**. Ne pas inventer de valeur.
- **ADR-019** — le mode test appartient à l'organisation, pas à l'appel. En Phase 4, le
  moteur d'appel doit qualifier chaque appel via `call_is_test()`, jamais faire confiance
  à un drapeau reçu du fournisseur téléphonique.
- **ADR-020** — fournisseur de voix : **Vapi en région européenne, trunk SIP apporté**.
  Ce qui tranche n'est pas le code : l'API Realtime d'OpenAI en mode SIP exige une
  WebSocket maintenue pendant tout l'appel, ce que Vercel ne permet pas.
- **ADR-021** — les jetons d'agenda sont chiffrés par l'application et leurs colonnes
  n'ont aucun privilège pour `authenticated`.
- **ADR-022** — acquisition des numéros de téléphone : **décision ouverte**. Contrainte
  réglementaire réelle en France et en Belgique. Ne pas la trancher seul.

## Problèmes connus et leçons apprises

1. ~~Les tests d'isolation n'ont jamais tourné.~~ **Résolu le 2026-09-08.**
2. ~~Aucune migration appliquée.~~ **Résolu** : les seize sont appliquées et vérifiées.
3. **`src/types/database.ts` est manuel** et peut dériver du schéma réel. Une tentative de
   régénération a échoué (la CLI attendait une connexion, masquée par la redirection `>`).
   Principal point technique ouvert, sans effet connu aujourd'hui.
4. Le contrôle « toute table publique a RLS » dans les tests s'appuie sur une fonction
   absente par défaut ; il s'ignore silencieusement. À remplacer en Phase 8.
5. **Une variable `NEXT_PUBLIC_` absente au build devient une chaîne vide, pas
   `undefined`.** Toute validation de configuration doit convertir les chaînes vides en
   `undefined`. Vu en production le 2026-09-08.
6. **Ne jamais rediriger une page vers elle-même.** Une redirection calculée depuis un
   état stocké doit être comparée à la route courante. Vu en production le 2026-09-08.
7. **Un fichier `"use server"` n'exporte que des fonctions asynchrones.** Un objet exporté
   passe le build et le typecheck, puis échoue quand l'utilisateur soumet le formulaire.
   Couvert par `tests/server-actions.test.ts`.
8. **Toute page dépendant de la session doit porter `export const dynamic =
   "force-dynamic"`.** Sinon Next la prérend au build, sans session ni variables.
9. **Vercel exécutait les fonctions à `iad1` (Washington)** alors que le registre des
   sous-traitants engage un traitement en UE. `vercel.json` fixe `fra1` ; à confirmer dans
   les réglages du projet. Le middleware sur le réseau de périphérie reste un point ouvert.
10. **Les quatre bugs de production du 2026-09-08 ont tous passé typecheck, lint et
    build.** Ils n'ont été trouvés qu'en parcourant l'application réelle. Des tests de
    bout en bout (navigateur automatisé sur le parcours d'inscription) manquent toujours ;
    ils étaient prévus en Phase 8 et devraient venir plus tôt.
11. **Un commentaire qui affirme une propriété de sécurité ne la garantit pas.** La faille
    des jetons d'agenda (ADR-021) a survécu à une relecture parce que l'intention était
    écrite juste à côté du code qui la contredisait. Vérifier les `grant` et les policies,
    pas les commentaires.
12. **Un avertissement de variable inutilisée au build signale souvent une modification
    à moitié appliquée.** C'est ainsi qu'a été repérée la section agenda manquante de la
    page Plus, le 2026-09-24. Ne pas les ignorer.

---

## Prochaines tâches recommandées

**0. Obtenir un numéro de téléphone.** C'est le blocage du moment. Aucun numéro n'existe
côté Vapi ni en base, donc aucun appel réel n'est possible et tout est marqué essai. Court
terme : un numéro américain gratuit chez Vapi, pour exercer la chaîne réelle. Avant le
premier client : un numéro belge ou français, qui demande une preuve d'adresse et plusieurs
jours de dossier.

**1. Appliquer la migration 0022**, puis déployer. Elle ajoute `call_id` sur `leads`,
`appointments` et `tasks`, reprend l'historique, et étend `dashboard_counts()`. Sans elle,
l'accueil et la liste des appels échouent : le type TypeScript attend deux colonnes que la
fonction ne renvoie pas encore.

**2. Comparer les transcripteurs.** Soniox, puis Deepgram, puis Google, en dictant à chaque
fois le même nom, la même ville et le même numéro. C'est la tâche la plus rentable du
moment : tant que la transcription se trompe, tout ce qui est en aval travaille sur des
données fausses. Aucun classement public francophone ne permet de trancher sur dossier.

**3. Appliquer les réglages de prise de parole** (`On Number Seconds` 2.5, `Smart
Endpointing` `vapi`, `On No Punctuation Seconds` 2.0, `Number of Words` 2, `Voice Seconds`
0.3) et retester un numéro dicté.

**4. Vérifier l'acceptation d'un rendez-vous** de bout en bout : accepter un « À valider »
et contrôler que l'événement apparaît dans Google Calendar.

**5. Phase 5 — l'audio.** Bloquée par `VOICE_API_KEY` sur Vercel. Récupérer
l'enregistrement chez le fournisseur, le déposer dans le bucket privé européen, servir une
URL signée après contrôle de l'organisation, puis transcription, résumé et extraction, avec
des étapes indépendantes et reprenables (sections 13 à 16).

**6. Lancer la validation de l'application Google** (ADR-028). Le délai ne se rattrape pas,
et sans elle chaque client perdra son agenda une semaine après l'avoir connecté.

**Dettes utiles à tout moment** : écran *Sophie → Connaissances*, édition des services et
horaires, gestion des absences, régénération de `src/types/database.ts`.

## Ce qui attend une décision

**Tranché** : pays (France et Belgique), rétention audio (30 jours), design et palette,
domaine de production (**zelicall.com**, ADR-023), modèle de numéro — l'artisan garde son
numéro et le renvoie (ADR-022), fournisseur de voix — Vapi, région US faute d'accès
libre-service à la région européenne (ADR-026).

**Ouvert** : nom commercial du produit — le domaine est zelicall.com, le code dit
« Sophie IA » partout (ADR-023) ; transcripteur ; fournisseur IA post-appel ; fournisseur
SMS ; durées de conservation autres que l'audio (ADR-018).

**Chantiers non techniques** : `docs/LEGAL_COMPLIANCE.md`, points L1 à L12, avec pour
chacun ce qu'il bloque. Ils peuvent avancer en parallèle du développement.

Si une session future a besoin d'une de ces valeurs, la réponse correcte est de la
demander, pas de la choisir.

## Procédure de fin de phase

1. Terminer le périmètre prévu, rien de plus.
2. `npm run check` (typecheck + lint + tests + build).
3. Corriger les problèmes bloquants ; vérifier migrations et RLS.
4. Mettre à jour `DECISIONS.md`, `CHANGELOG.md`, ce fichier.
5. Incrémenter la version dans `package.json`.
6. `npm run release:zip`.
7. Indiquer ce qui fonctionne réellement et ce qui attend une clé externe.
8. Annoncer l'état de maturité.
9. Proposer le message de commit.
10. **Attendre la validation avant la phase suivante.**
