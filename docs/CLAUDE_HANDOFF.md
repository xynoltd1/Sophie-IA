# Reprise du projet

> Ce document est le point d'entrée d'une nouvelle session. Lisez-le en premier, puis
> `PROJECT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `LEGAL_COMPLIANCE.md`, `CHANGELOG.md`.
> **Le code et les tests font foi.** Si ce document et le code divergent, vérifiez le code,
> corrigez ce document, et signalez l'écart.

---

## Où en est le projet

**Version** 0.20.0 · **Phases 0 à 7 écrites ; trois fonctions majeures jamais exercées en réel** · **Vérifié le 2026-11-05**

> **La console d'administration, le référencement et la mesure de fréquentation ont
> leurs propres documents** : `docs/ADMIN_DASHBOARD.md`, `docs/SEO.md`,
> `docs/ANALYTICS.md`. Les lire avant de toucher à `/admin`, au site public ou à la
> collecte.
>
> **Pour tout ce qui dépend de Zehra et non du code — comptes, clés, numéro, juridique —
> lire `docs/OWNER_ACTION_PLAN.md`.** C'est la liste ordonnée de ses actions, avec les
> dépendances et les preuves de réussite. Ne lui redemandez pas une étape qu'elle y a
> cochée.
>
> **Lire aussi `docs/FUNCTIONAL_AUDIT.md`** : l'état réel de chaque fonctionnalité, vérifié
> dans le code. Les sept problèmes qui y étaient listés en 0.14.0 ont été repris en
> 0.15.0 : six sont traités, le septième — l'usage réel des connaissances pendant un appel —
> demande un appel sur un vrai numéro.

**État de maturité : `TECHNICALLY READY` + `LEGAL REVIEW REQUIRED`.**
Pas `PRODUCTION READY`, et pas « candidate à la 1.0 » non plus. Trois fonctions centrales
n'ont jamais touché un service réel : le résumé (pas de clé d'IA), le SMS (pas de compte
opérateur), l'appel sur un vrai numéro (pas de numéro). La `PRE_PRODUCTION_LEGAL_CHECKLIST`
de `docs/LEGAL_COMPLIANCE.md` reste ouverte.

### Le scénario du cahier des charges, section 63

| Étape | État |
|---|---|
| Configuration entreprise, métier, services, horaires | ✅ vérifié |
| Agenda Google connecté | ✅ vérifié le 2026-10-15 par un événement réel |
| Un client appelle, Sophie répond en français | ✅ vérifié les 22 et 23 octobre |
| Elle comprend, identifie ou crée le contact | ✅ vérifié |
| Elle vérifie les vraies disponibilités, propose un créneau | ✅ vérifié |
| Le créneau est bloqué, rendez-vous « À valider » | ✅ vérifié |
| L'artisan est alerté | ✅ accueil, pastille et écran d'alertes |
| L'audio est conservé chez nous et écoutable | ✅ vérifié le 2026-10-23 |
| La transcription apparaît | ✅ vérifié |
| Le résumé apparaît | ⚠️ écrit, produit par nous (ADR-031), **jamais exercé** : pas de clé |
| Il accepte, l'agenda Google est mis à jour | ⚠️ écrit, **jamais exercé** avec un vrai rendez-vous |
| Le client reçoit le SMS | ⚠️ écrit, **jamais envoyé** : pas de compte opérateur |

Les trois dernières lignes sont les seules qui restent, et aucune ne dépend du code.

### Vérifications passées, exécutées le 2026-11-02

```
npm run typecheck   ✓
npm run lint        ✓
npm run test        ✓  383 tests passés, 0 ignoré avec SUPABASE_TEST_* (2026-11-04)
npm run build       ✓
```

**Ces quatre contrôles ne suffisent pas.** La version 0.5.1 les passait tous et son
déploiement a été refusé par Vercel (ADR-024). Avant d'annoncer une version livrable,
vérifier qu'un déploiement réel est passé.

**La suite d'isolation multi-tenant a tourné contre une vraie base le
2026-11-04** : 356 tests, **zéro ignoré**, 17 d'entre eux exercés contre le
projet Supabase de préproduction. Sont vérifiés, en conditions réelles :
lecture et écriture croisées entre deux organisations, auto-promotion comme
membre ou comme administrateur de plateforme, illisibilité du journal d'audit,
RLS active sur toutes les tables, et — depuis les migrations 0031 et 0032 —
l'absence du droit de vider une table.

Pour les relancer : renseigner `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY` et
`SUPABASE_TEST_SERVICE_ROLE_KEY` dans `.env.local`, **jamais sur Vercel**, et de
préférence avec les clés de la préproduction.

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

**Workflow du rendez-vous (Phase 6, 0.13.0)**
- Accepter, refuser avec motif, proposer un autre horaire, annuler. Chaque décision peut
  prévenir le client, et l'échec du message ne défait jamais la décision.
- Page publique de réponse du client, par jeton, sans compte (ADR-034).
- File des messages sortants avec reprise, accusés de réception, SMS entrants.
- Alertes avec déduplication, pastille dans l'en-tête, écran dédié.

**Réglages (0.13.0)**
- Services, horaires, absences et vacances, équipe et invitations, connaissances de Sophie,
  intégrations, consommation du mois. Chaque écran vérifie le rôle côté serveur.

**Administration de la plateforme (Phase 7, 0.13.0)**
- Entreprises, métiers modifiables sans déploiement, offres, abonnements, consommation,
  erreurs des fournisseurs, santé des intégrations.
- Autorisation entièrement séparée de celle des entreprises. Aucun accès aux
  enregistrements (ADR-033). Chaque écriture est journalisée.

**Conversations (0.13.0)**
- Entité `Conversation` avec les cinq canaux ; fil unifié sur la fiche contact réunissant
  appels, messages, rendez-vous et demandes.

## Ce qui est écrit mais jamais exercé

Le registre `src/lib/providers/status.ts` fait foi. Un test interdit d'y déclarer une
intégration externe `PRODUCTION_READY`.

| Élément | État | Ce qui manque |
|---|---|---|
| Résumé et extraction | `BLOCKED_EXTERNAL_CONFIG` | `AI_API_KEY`. Sans elle, un résumé **simulé** s'affiche en disant qu'il l'est |
| SMS (confirmation, refus, annulation, proposition) | `BLOCKED_EXTERNAL_CONFIG` | compte opérateur et numéro expéditeur. L'adaptateur gère signature, idempotence et reprise, mais aucun SMS n'est jamais parti |
| Écriture d'un rendez-vous confirmé dans Google Calendar | code en place | accepter un vrai rendez-vous et vérifier l'événement |
| Réponse du client à une proposition d'horaire | code en place | dépend du SMS pour que le lien arrive |
| Administration de la plateforme | écrite en entier | aucun compte administrateur n'a encore été créé (`profiles.is_platform_admin`) |
| SMS entrant et conversations | code en place | dépend du compte opérateur |

**Vérifié et acquis :** OAuth Google et disponibilités réelles (15 octobre), Sophie Voice
avec ses huit outils (22-23 octobre), audio rapatrié et écouté, transcription horodatée
(23 octobre).

## Ce qui est partiel

| Élément | État |
|---|---|
| Transcription en français | qualité insuffisante : « Tongeren » → « Tangerine », numéros dictés tronqués. Deepgram et Google restent à comparer (`docs/VOICE_PROVIDERS.md`) |
| Sophie coupe la parole | réglages identifiés, à appliquer et retester |
| Purge des transcriptions et des SMS | écrite en 0.15.0 (migration 0030) : trois durées par entreprise, journal `retention_runs`, six purges indépendantes. **Jamais exercée sur des données réellement arrivées à échéance**, et les durées attendent une validation juridique |
| WhatsApp, e-mail, formulaire web | structure en base, aucun adaptateur, aucun point d'entrée |
| Invitations d'équipe | le lien est affiché et transmis à la main : aucun service d'envoi d'e-mail |
| Réglages de notification | déduplication en base, mais pas de préférence par utilisateur |
| Connaissances de Sophie | l'écran existe, l'outil les lit et passe avant les autres sources ; **l'usage réel pendant un appel reste non vérifié** — le fournisseur vocal n'est pas appelable depuis cet environnement. C'est la dernière ligne ouverte de l'audit 0.14.0 |
| Écran de tâches | écrit en 0.15.0 : `/app/taches`, quatre vues, clôture d'un pouce. Jamais exercé avec des tâches créées par Sophie en appel réel |
| Configuration de Sophie après l'inscription | voix, style et message d'accueil se changent chez le fournisseur, pas dans l'application. `/app/sophie` dit l'état réel de la ligne et le reconnaît au lieu de promettre un écran absent |
| Ligne téléphonique | écran écrit en 0.15.0 (`/app/sophie/ligne`), trois modes de raccordement. **Aucun numéro n'est encore déclaré** : tant que `phone_numbers` est vide, chaque appel tombe dans le repli « essai » |
| `src/types/database.ts` | écrit à la main (ADR-012), à régénérer depuis le schéma réel |
| Application Google | en mode Test : autorisations révoquées à 7 jours (ADR-028) |
| Préproduction | documentée dans `DEPLOYMENT.md`, jamais montée |

## Ce qui n'est pas commencé

Adaptateurs WhatsApp, e-mail et formulaire web. Envoi d'e-mails transactionnels. Tests de
bout en bout automatisés. Facturation réelle (les offres et abonnements existent, aucun
paiement n'est branché, et aucun prix n'est fixé — volontairement, section 38).

## Architecture en trois phrases

Next.js App Router sur Vercel, sans back-end séparé (ADR-001). L'isolation des clients
repose sur RLS PostgreSQL, pas sur des filtres applicatifs (ADR-003). Le flux audio d'un
appel **ne passe jamais par Vercel** : notre application n'expose que des outils HTTP
appelés pendant la conversation (ADR-002) — c'est la contrainte la plus structurante du
projet, et le premier critère de choix du fournisseur de voix.

## Migrations — trente-six

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
0024_recording_storage           bucket prive call-recordings, metadonnees audio sur
                                 calls, expired_recordings()
0023_call_intelligence           call_events (rapport brut, purge 30 jours),
                                 call_transcript_segments, calls.summary,
                                 calls.structured_data, purge_expired_call_events()
0022_call_links                  call_id sur leads, appointments, tasks ;
                                 dashboard_counts compte les rendez-vous a valider,
                                 les appels sans suite et les appels echoues
0025_summary_pipeline            colonnes de reprise du resume, calls_awaiting_summary()
0026_appointment_workflow        outbound_messages, notifications, proposition d horaire
                                 par jeton, respond_to_proposal(), messages_to_send()
0027_platform_admin              plans, subscriptions, usage_records, provider_errors,
                                 platform_overview(), ecriture des metiers
0028_conversations               conversations, conversation_messages,
                                 receive_inbound_message()
0029_calls_management            cle etrangere membre -> profil (corrige la liste
                                 d equipe), corbeille des appels, search_calls(),
                                 trash_calls(), restore_calls(), calls_to_purge()
0030_retention_and_lines         trois durees de conservation par organisation (30 j a
                                 5 ans, bornees en base), retention_runs (journal des
                                 purges, lisible du seul super admin),
                                 purge_expired_transcripts(), purge_expired_summaries(),
                                 purge_expired_messages(), record_retention_run(),
                                 enum line_connection_mode, colonnes de phone_numbers
                                 (connection_mode, public_number, last_error,
                                 verified_at) et leurs policies OWNER/ADMIN
0031_revoke_truncate             retire TRUNCATE, REFERENCES et TRIGGER a anon et
                                 authenticated sur les tables existantes ET les
                                 privileges par defaut. TRUNCATE ignore RLS :
                                 c est le seul droit qui traverse l isolation.
                                 Trouve sur la vraie base le 2026-11-03.
0032_revoke_truncate_views       le meme nettoyage pour les vues : pg_tables ne
                                 les contient pas, calendar_status avait ete
                                 manquee par la 0031.
0033_analytics_and_stats         site_events (frequentation sans cookie, trois
                                 classifications), integration_checks (preuve
                                 datee qu une integration fonctionne), et neuf
                                 fonctions d agregation reservees au super
                                 administrateur : platform_stats,
                                 platform_series, usage_totals, site_traffic,
                                 site_sources, site_pages, site_series,
                                 record_integration_check, integration_health.
0034_platform_configuration      platform_settings (reglages non secrets),
                                 provider_credentials (secrets chiffres, AUCUNE
                                 policy de lecture, aucun GRANT),
                                 search_console_connection, credentials_state()
                                 et search_console_state() qui exposent l etat
                                 sans jamais les valeurs.
0035_seo_pages                   seo_pages (titre/description/indexable par page) avec
                                 la contrainte seo_pages_chemin_public qui refuse tout
                                 chemin prive ; bucket public public-assets (2 Mo,
                                 png/jpeg/webp) pour l image de partage.
```

0036_accueil_personnalise        colonnes d accueil sur sophie_configurations
                                 (spoken_name, formules par moment, position de
                                 l annonce) + sophie_runtime_for_number(), qui
                                 rend toute la configuration d un numero en un
                                 seul aller-retour. Revoquee a anon/authenticated.

**0033, 0034, 0035 et 0036 ne sont pas appliquées en production.** Les écrans qui en dépendent
— statistiques, consommation, SEO, intégrations, référencement page par page, envoi
d'image, accueil téléphonique — échouent tant qu'elles ne le sont pas. Procédure dans `OWNER_ACTION_PLAN.md`,
étape D2.

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

## Configuration : base d'abord, environnement ensuite

Depuis la 0.18.0, les cles des fournisseurs et les reglages du site se saisissent dans la
console et vivent en base. `src/lib/config/platform.ts` est la seule porte : **la base
l'emporte, l'environnement sert de filet**. Les adaptateurs (`providers/ai`,
`providers/messaging`) sont devenus asynchrones pour cela.

Trois cles restent dans l'environnement et ne seront jamais reglables depuis un ecran :
`SUPABASE_SERVICE_ROLE_KEY`, `SECRETS_ENCRYPTION_KEY`, `CRON_SECRET`. La raison est
mecanique (ADR-041). `VOICE_WEBHOOK_SECRET` les rejoint : un secret qui protege une entree
ne se regle pas depuis l'interieur.

Cache d'une minute, en memoire du processus : une modification se propage en une minute au
plus sur Vercel, sans redeploiement.

## Variables d'environnement

Ajoutée en 0.17.0 : `GOOGLE_SITE_VERIFICATION`, facultative, jeton de propriété Search
Console. Absente, aucune balise n'est émise — une balise vide se lit comme une tentative
ratée.

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

**1. Appliquer les migrations 0025 à 0030**, dans l'ordre, puis déployer. Sans elles,
plusieurs écrans échouent : le code attend des colonnes et des tables qui n'existent pas
encore. La 0030 est indispensable à `/app/reglages/conservation` et à `/app/sophie/ligne`.

**2. Créer le premier compte administrateur de plateforme.** L'espace `/admin` est écrit
mais inaccessible : aucun profil n'a `is_platform_admin = true`. Une ligne de SQL.

**3. Renseigner `AI_API_KEY`** pour que le résumé cesse d'être simulé. Mistral est le choix
à retenir pour l'Europe : les transcriptions contiennent nom, adresse et problème d'un
client.

**4. Obtenir un numéro de téléphone.** C'est ce qui bloque la vérification de bout en bout.
Court terme : un numéro américain gratuit chez le fournisseur de voix. Avant le premier
client : un numéro belge ou français, qui demande une preuve d'adresse et plusieurs jours.

**5. Ouvrir un compte opérateur SMS**, puis déclarer les deux webhooks (voir
`DEPLOYMENT.md`, section 5).

**6. Lancer la validation de l'application Google** (ADR-028). Le délai ne se rattrape pas.

**7. Déclarer un numéro dans `/app/sophie/ligne`** dès qu'un numéro existe, puis
**appeler ce numéro une fois**. Ce seul appel vérifie d'un coup : le rattachement du numéro
à l'organisation, `verified_at`, les connaissances de Sophie pendant la conversation, le
résumé réel, et la fiche d'appel complète. C'est la vérification la plus rentable qui reste.

**8. Valider juridiquement les trois durées de conservation.** Le réglage existe depuis la
0.15.0 et les valeurs par défaut sont d'un an, choisies techniquement. La valeur correcte
dépend du pays et du métier (`LEGAL_COMPLIANCE.md`, point L5).

**9. Ajouter la portée Search Console au client OAuth Google** et déclarer l'adresse de
retour `/api/integrations/search-console/callback` (`OWNER_ACTION_PLAN.md`, D3b). La
connexion est écrite et fonctionnelle ; sans cette portée, Google refuse l'autorisation.

**10. Régler l'assistant Vapi pour l'accueil personnalisé** (`OWNER_ACTION_PLAN.md`,
B4b) : première phrase `{{premierMessage}}`, adresse serveur du **numéro** vers
`/api/voice/assistant`, et numéro laissé sans assistant fixe. Sans ces trois réglages,
le code est en place et le fournisseur continue de prononcer sa phrase figée.

**Dettes utiles à tout moment** : régénérer `src/types/database.ts`, comparer les
transcripteurs, monter la préproduction.

## Leçon de la 0.20.0 — la vérité est dans ce qui est prononcé

L'accueil téléphonique est le premier endroit où « le formulaire enregistre » et « le
client entend » pouvaient diverger sans que rien ne le signale. Trois choix en
découlent, à garder pour toute fonction qui finit en paroles :

**L'aperçu appelle la fonction du serveur.** `composerAccueil` est pur et importé des
deux côtés. Un aperçu qui recomposerait la phrase de son côté finirait par mentir.

**La garantie légale est au dernier point de passage.** La mention d'IA est ajoutée par
le composeur, pas vérifiée par le formulaire : seul le composeur est traversé par
toutes les phrases, y compris celles écrites l'an dernier.

**La phrase part par deux chemins.** `variableValues` est documenté chez le
fournisseur, `firstMessage` ne l'est pas. Les deux portent la même phrase. Un test
vérifie qu'elles sont identiques — si l'une est ignorée, l'autre tient.

## Leçon de la 0.19.0 — une page statique ne relit pas la base

La page d'accueil, `robots.txt` et `sitemap.xml` lisaient des réglages en base, et Next
les prérendait au build. Le formulaire d'administration écrivait correctement ; le site
affichait les valeurs du dernier déploiement. L'écran annonçait pourtant « s'applique
d'ici une minute ».

Les trois portent maintenant `export const revalidate = 60`, et un test le vérifie
(ADR-045).

**Le réflexe à garder** : ajouter une lecture en base dans un fichier de métadonnées ou
une page statique est un changement de mode de rendu, pas une modification locale. La
vérification n'est pas « le formulaire enregistre-t-il ? » mais « la valeur apparaît-elle
sur la page servie ? ».

## Ce qui attend une décision

**Tranché** : pays (France et Belgique), rétention audio (30 jours), design, domaine
(**zelicall.com**, ADR-023), modèle de numéro — renvoi depuis le numéro de l'artisan
(ADR-022), fournisseur de voix — Vapi, région US faute de libre-service européen (ADR-026),
résumé produit par nous (ADR-031), opérateur SMS pressenti — compatible Twilio (ADR-032),
séparation stricte de l'administration plateforme (ADR-033).

**Ouvert** : nom commercial du produit — le domaine est zelicall.com, le code dit « Sophie
IA » partout (ADR-023) ; transcripteur ; fournisseur d'IA post-appel (Mistral conseillé,
non décidé) ; **valeurs** des durées de conservation hors audio — le mécanisme est tranché
(ADR-036), les durées correctes non ; prix des offres (volontairement non fixés,
section 38) ; voix et style de Sophie dans l'application ou chez le fournisseur.

**Chantiers non techniques** : `docs/LEGAL_COMPLIANCE.md`, points L1 à L12.

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
