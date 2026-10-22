# Reprise du projet

> **Avant tout : lire `docs/VERIFICATION_PHASE4.md`.** La version 0.7.0 contient du code
> écrit mais jamais exercé contre un vrai appel. Ne pas construire par-dessus avant que ces
> vérifications aient été faites.
>
> Ce document est le point d'entrée d'une nouvelle session. Lisez-le en premier, puis
> `PROJECT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `LEGAL_COMPLIANCE.md`, `CHANGELOG.md`.
> **Le code et les tests font foi.** Si ce document et le code divergent, vérifiez le code,
> corrigez ce document, et signalez l'écart.

---

## Où en est le projet

**Version** 0.7.0 · **Phase 4 : outils métier écrits, NON vérifiés par un appel réel** · **Vérifié le 2026-10-22**

**État de maturité : `TECHNICALLY READY` + `LEGAL REVIEW REQUIRED`.**
Pas `PRODUCTION READY` : la `PRE_PRODUCTION_LEGAL_CHECKLIST` de
`docs/LEGAL_COMPLIANCE.md` n'est pas validée. Aucun client réel, aucun appel réel, aucun
enregistrement réel tant qu'elle ne l'est pas. Le développement technique continue
normalement.

**Sophie répond.** Premier essai vocal réel le 2026-10-22 (Vapi, région US, essai navigateur) : elle a parlé français, appelé `check_availability`, et utilisé la réponse du serveur pendant la conversation. Reste à faire : l'appel sur un vrai numéro, l'audio dans notre espace européen, et le post-appel.

**Ancienne note, conservée pour mémoire :** C'est la Phase 4. Le fournisseur de voix est
choisi (Vapi EU, ADR-020) ; il manque un compte et un numéro de téléphone, et le modèle
d'acquisition des numéros reste une décision ouverte (ADR-022).

**Google Calendar est vérifié de bout en bout depuis le 2026-10-15** : un événement réel
placé dans l'agenda retire bien les créneaux correspondants des disponibilités proposées.

### Vérifications passées, exécutées le 2026-10-14

```
npm run typecheck   ✓
npm run lint        ✓
npm run test        ✓  121 tests passés, 17 ignorés (SUPABASE_TEST_* non renseignées ici)
npm run build       ✓
```

**Ces quatre contrôles ne suffisent pas.** La version 0.5.1 les passait tous et son
déploiement a pourtant été refusé par Vercel : la tâche planifiée était trop fréquente pour
un compte Hobby, ce qui est une règle de la plateforme, appliquée avant la compilation
(ADR-024). `tests/vercel-config.test.ts` couvre désormais ce cas. Avant d'annoncer une
version livrable, **vérifier qu'un déploiement réel est passé**, pas seulement que le build
est vert en local.

Les 17 tests ignorés sont la suite d'isolation multi-tenant et un contrôle de
configuration. Ils **ont tourné avec succès contre la vraie base le 2026-09-08** ; ils
s'ignorent seulement quand les variables `SUPABASE_TEST_*` sont absentes de `.env.local`.

---

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

## Ce qui est écrit mais jamais exercé

Le registre `src/lib/providers/status.ts` fait foi. Un test interdit d'y déclarer une
intégration externe `PRODUCTION_READY`.

| Élément | État | Ce qui manque |
|---|---|---|
| Google Calendar | `BLOCKED_EXTERNAL_CONFIG` | projet Google Cloud et identifiants OAuth. Tout le code existe : OAuth, chiffrement des jetons, synchronisation incrémentale, webhook, job de rattrapage, écriture des rendez-vous. **Aucune requête n'est jamais partie vers Google.** |
| Sophie Voice | `BLOCKED_EXTERNAL_CONFIG` | compte Vapi en région européenne. La partie testable sans compte l'est : signature HMAC, décodage, endpoint d'outils, deux outils métier. |

## Ce qui est partiel

| Élément | État |
|---|---|
| Écran Appels | état vide honnête ; la téléphonie est en Phase 4 |
| Écran Sophie | état vide ; l'écran *Sophie → Connaissances* reste à faire (la table `business_knowledge` existe) |
| Paramètres | pas d'édition des services et horaires après l'onboarding ; pas de gestion des absences |
| `src/types/database.ts` | écrit à la main (ADR-012), à régénérer depuis le schéma réel |

## Ce qui n'est pas commencé

Téléphonie, `SophieEngine`, `VoiceAIProvider`, outils métier de Sophie, transfert et
repli, enregistrement audio, lecteur, transcription, résumé, extraction, jobs asynchrones,
SMS, notifications, console plateforme, abonnements et usage, observabilité.

---

## Architecture en trois phrases

Next.js App Router sur Vercel, sans back-end séparé (ADR-001). L'isolation des clients
repose sur RLS PostgreSQL, pas sur des filtres applicatifs (ADR-003). Le flux audio d'un
appel **ne passe jamais par Vercel** : notre application n'expose que des outils HTTP
appelés pendant la conversation (ADR-002) — c'est la contrainte la plus structurante du
projet, et le premier critère de choix du fournisseur de voix.

## Migrations — seize, toutes appliquées et vérifiées

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

**Immédiat — appliquer la migration 0017.** Elle corrige la faille des jetons d'agenda.
Puis relancer `supabase/checks/01_verify_schema.sql`.

**Ensuite — créer le projet Google Cloud** (`docs/DEPLOYMENT.md`, section 2). Gratuit.
Tant qu'il n'existe pas, Google Calendar reste `BLOCKED_EXTERNAL_CONFIG` et Sophie
proposera des créneaux déjà pris dans l'agenda personnel de l'artisan.

**Puis — le spike Vapi.** Critère de réussite, à ne pas assouplir :
appel entrant réel → Sophie répond → conversation dans les deux sens → Sophie appelle
`check_availability` sur notre backend → le backend répond → Sophie utilise la réponse
pendant l'appel.

L'endpoint `/api/voice/tools` et l'outil `check_availability` sont écrits et testés pour
la partie qui ne demande pas de compte. Ce qui manque est le compte Vapi et un numéro.

**Ne pas écrire le reste de la Phase 4 avant que le spike soit validé.** Un adaptateur
écrit contre une API devinée produit du code qui a l'air fini et ne marche pas.

**Dettes utiles à tout moment** : écran *Sophie → Connaissances*, édition des services et
horaires depuis les paramètres, gestion des absences, tests de bout en bout.

---

## Ce qui attend une décision

**Tranché** : pays (France et Belgique), rétention audio (30 jours), design et palette,
domaine de production (**zelicall.com**, ADR-023).

**Ouvert** : nom commercial du produit — le domaine est zelicall.com, le code dit
« Sophie IA » partout (ADR-023) ; modèle de numéro de téléphone (fourni, renvoi ou
portage) ; fournisseur de téléphonie et de voix ; fournisseur IA post-appel ; durées de conservation autres que
l'audio (ADR-018) ; région d'hébergement des fournisseurs (ADR-017) ; région du middleware.

**Chantiers non techniques** : `docs/LEGAL_COMPLIANCE.md`, points L1 à L12, avec pour
chacun ce qu'il bloque. Ils peuvent avancer en parallèle du développement.

Si une session future a besoin d'une de ces valeurs, la réponse correcte est de la
demander, pas de la choisir.

---

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
