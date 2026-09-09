# Reprise du projet

> Ce document est le point d'entrée d'une nouvelle session. Lisez-le en premier, puis
> `PROJECT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `CHANGELOG.md`.
> **Le code et les tests font foi.** Si ce document et le code divergent, vérifiez le code,
> corrigez ce document, et signalez l'écart.

---

## Où en est le projet

**Version** 0.3.2 · **Phase 2 terminée** · **Dernière mise à jour** 2026-09-07

**État de maturité : `TECHNICALLY READY` + `LEGAL REVIEW REQUIRED`.**
Pas `PRODUCTION READY` : la `PRE_PRODUCTION_LEGAL_CHECKLIST` de
`docs/LEGAL_COMPLIANCE.md` n'est pas validée. Aucun client réel, aucun appel réel, aucun
enregistrement réel tant qu'elle ne l'est pas. Le développement technique, lui, continue
normalement.

Sophie ne répond pas encore au téléphone. La Phase 0 pose les fondations : un tenant
existe, un utilisateur peut créer son entreprise, l'isolation multi-tenant est réelle et
testable, le design system est posé.

### Vérifications passées à la clôture de la phase

```
npm run typecheck   ✓
npm run lint        ✓  (via next build)
npm run test        ✓  22 tests passés, 10 ignorés (base de test non configurée)
npm run build       ✓  14 routes générées
```

---

## Ce qui fonctionne réellement

- **Authentification** e-mail et mot de passe : inscription, connexion, déconnexion,
  route de callback protégée contre l'open redirect.
- **Multi-tenant** : création d'organisation via `create_organization()`, appartenance
  `OWNER` automatique, RLS active sur toutes les tables publiques.
- **Session** : `getSessionContext()`, `requireSession()`, `requireOrganization()`.
  L'organisation active est en cookie mais confrontée à `my_organizations()` à chaque fois.
- **Onboarding étape 1** : formulaire entreprise + pays, réellement enregistré.
- **Écran Plus** : lit l'équipe sous RLS, affiche le rôle, permet la déconnexion.
- **Coquille mobile** : en-tête avec l'état de Sophie, navigation basse à cinq entrées.
- **Design system** : jetons couleur et typographie, `Button`, `Field`, `Input`, `Sheet`,
  et les quatre états (chargement, vide, erreur, succès).
- **PWA** : manifeste, icônes générées, thème, zones sûres iOS.
- **Sonde** `/api/health`.

## Ce qui est partiel

| Élément | État |
|---|---|
| Onboarding | sept étapes fonctionnelles ; l'étape agenda annonce Google Calendar pour la Phase 3 au lieu de connecter |
| Écrans Prospects, Agenda, Appels, Sophie | états vides honnêtes, aucune donnée derrière |
| `src/types/database.ts` | écrit à la main (ADR-012), à régénérer dès que le projet Supabase existe |
| Tests d'isolation | écrits et complets, mais **jamais exécutés** faute de base de test |

## Ce qui n'est pas commencé
tâches, recherche, Google Calendar, `AvailabilityEngine`, holds, rendez-vous, téléphonie,
`SophieEngine`, Voice, enregistrement audio, lecteur, transcription, résumé, extraction,
jobs asynchrones, SMS, notifications, console plateforme, abonnements, observabilité.

---

## Architecture en trois phrases

Next.js App Router sur Vercel, sans back-end séparé (ADR-001). L'isolation des clients
repose sur RLS PostgreSQL, pas sur des filtres applicatifs (ADR-003). Le flux audio d'un
appel **ne passe jamais par Vercel** : notre application n'expose que des outils HTTP
appelés pendant la conversation (ADR-002) — c'est la contrainte la plus structurante du
projet.

## Migrations

```
0001_extensions_and_helpers   extensions, set_updated_at, normalize_phone, slugify
0002_core_identity            profiles, organizations, organization_members, invitations
0003_activity_and_audit       activities (lisible par le tenant), audit_logs (jamais)
0004_authorization_functions  is_org_member, org_role, has_org_role, my_organizations,
                              create_organization
0005_rls_policies             RLS + une policy par opération
0006_audio_retention_policy   enregistrement désactivé par défaut, rétention audio
                              plafonnée à 30 jours en base, table de preuve de purge
0007_recording_notice_templates  textes d'annonce par pays et par langue, non validés
                              par défaut ; recording_allowed() refuse l'enregistrement
                              d'un appel réel sans annonce validée
0008_test_organizations       is_test_organization ; un appel de test n'est reconnu que
                              dans une organisation d'essai ; call_is_test() fait foi
```

**Règle absolue** : toute nouvelle table portant un `organization_id` reçoit RLS, ses
policies, **son `GRANT` à `authenticated`** et son index `(organization_id, …)` dans la
même migration. Une table sans policy est une fuite de données ; une table sans `GRANT`
est inaccessible même à son propriétaire — les deux erreurs se sont produites, la seconde
a été trouvée par les tests.

**Écrire des contrôles positifs autant que négatifs.** La suite d'isolation ne contenait
que des assertions « X ne doit pas voir Y ». Une base entièrement verrouillée les faisait
toutes passer. Quatre contrôles positifs ont été ajoutés ; garder ce réflexe.

## Variables d'environnement

Requises en Phase 0 : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`. Toutes les autres sont déclarées dans `.env.example`, groupées
par phase, et ne sont pas encore utilisées.

---

## Décisions importantes déjà prises

Voir `DECISIONS.md` pour le détail. Les cinq à connaître avant de toucher au code :

- **ADR-002** — la voix ne transite pas par Vercel ; `SophieEngine` est un ensemble
  d'endpoints, pas un processus.
- **ADR-003** — l'isolation est dans la base, pas dans le code.
- **ADR-004** — les fonctions d'autorisation sont `SECURITY DEFINER` pour éviter la
  récursion RLS ; `search_path` figé, filtrage sur `auth.uid()`.
- **ADR-005** — `organizations` n'a **aucune** policy INSERT ; la création passe par
  `create_organization()`.
- **ADR-008** — polices auto-hébergées via npm : le build est hermétique et aucune requête
  ne part vers Google.
- **ADR-013** — l'audio est conservé **30 jours maximum**, plafond appliqué par une
  contrainte en base ; la transcription et le résumé survivent à la purge.
- **ADR-014** — lancement limité à la France et à la Belgique ; ouvrir un pays est une
  décision juridique avant d'être une ligne de code.
- **ADR-015** — le texte d'annonce est une donnée, non validée par défaut ; le blocage de
  l'enregistrement réel est en base.
- **ADR-016** — trois états : `TECHNICALLY READY`, `LEGAL REVIEW REQUIRED`,
  `PRODUCTION READY`. Chaque livraison annonce le sien.
- **ADR-018** — les durées de conservation autres que l'audio sont une **décision
  ouverte**. Ne pas inventer de valeur.
- **ADR-019** — le mode test appartient à l'organisation, pas à l'appel. En Phase 4, le
  moteur d'appel doit qualifier chaque appel via `call_is_test()`, jamais faire confiance
  à un drapeau reçu de l'extérieur.

## Problèmes connus

1. ~~Les tests d'isolation n'ont jamais tourné.~~ **Résolu le 2026-09-08** : les douze
   contrôles d'isolation et les quatre contrôles positifs s'exécutent contre une vraie base
   Supabase. Ils ont révélé la migration `0012` manquante (privilèges de table).
2. ~~Aucune migration n'a été appliquée.~~ **Résolu** : les douze migrations sont
   appliquées et vérifiées par `supabase/checks/01_verify_schema.sql`.
3. **`src/types/database.ts` est manuel** et peut dériver du schéma réel. À régénérer avec
   `npx supabase gen types typescript --project-id <ref> > src/types/database.ts`, puis
   corriger les écarts que `npm run typecheck` remontera. C'est désormais le principal
   point ouvert côté technique.
4. Le contrôle « toute table publique a RLS » dans la suite de tests s'appuie sur une
   fonction utilitaire absente par défaut ; il s'ignore silencieusement. À remplacer par une
   vraie vérification en Phase 8.
5. **Une variable `NEXT_PUBLIC_` absente au build devient une chaîne vide, pas
   `undefined`.** Toute validation de configuration doit convertir les chaînes vides en
   `undefined`, sinon une variable facultative fait échouer l'application en production
   alors que le développement fonctionne. Vu en vrai le 2026-09-08.
6. **Ne jamais rediriger une page vers elle-même.** Une redirection calculée depuis un
   état stocké doit être comparée à la route courante avant d'être suivie ; sinon la
   boucle apparaît en production sous forme d'exception opaque. Vu en vrai le 2026-09-08.
7. **Un fichier `"use server"` n'exporte que des fonctions asynchrones.** Un objet ou une
   constante exportés y passent le build et le typecheck, puis échouent au moment où
   l'utilisateur soumet le formulaire. Couvert par `tests/server-actions.test.ts`.
8. **Toute page dépendant de la session doit porter `export const dynamic =
   "force-dynamic"`.** Sans cela, Next tente de la prérendre au build, où il n'existe ni
   session ni variable d'environnement, et le déploiement échoue. Vérifier ce point à
   chaque nouvelle page sous `(app)`.

---

## Prochaines tâches recommandées

**Fait le 2026-09-08** : douze migrations appliquées, scripts de vérification verts,
suite d'isolation exécutée avec succès contre une vraie base.

**Avant la Phase 2 :**

1. Régénérer `src/types/database.ts` avec `supabase gen types` et corriger les écarts.
2. Renseigner les variables d'environnement sur Vercel et vérifier que le taux d'erreur
   retombe à zéro.
3. Pousser sur GitHub depuis un dépôt cloné, pas depuis un dossier extrait d'archive.

**Phase 3 — Agenda (cible 0.4.0)**

Google Calendar (compte Google Cloud et identifiants OAuth à préparer), `AvailabilityEngine`,
holds avec expiration, rendez-vous et leurs états, prévention de la double réservation par
contrainte d'exclusion — l'extension `btree_gist` est installée depuis la Phase 0 pour ça.

**Ancienne Phase 2 — CRM (livrée en 0.3.0 à 0.3.2)**

Migrations : `contacts` (déduplication par téléphone normalisé — `normalize_phone()` existe
déjà), `leads` avec le pipeline `NEW → QUALIFIED → APPOINTMENT → CUSTOMER → WON | LOST`,
`tasks`. Puis les écrans Prospects et fiche contact, la recherche globale (prévoir `pg_trgm`
et des index GIN), et le remplissage réel du bloc « À traiter » de l'accueil.

Restent aussi de la Phase 1, volontairement laissés de côté : l'écran
*Sophie → Connaissances* (la table `business_knowledge` existe), l'édition des services et
horaires depuis les paramètres après l'onboarding, et la gestion des absences.

Aucun compte externe supplémentaire n'est nécessaire pour la Phase 2.

---

## Ce qui attend une décision de votre part

**Tranché** : pays (France et Belgique), rétention audio (30 jours maximum).

**Reste ouvert**, détaillé dans `PRODUCT_SPEC.md` : le modèle de numéro de téléphone
(fourni par Sophie IA, renvoi depuis le numéro existant, ou portage), et le choix du
fournisseur de téléphonie et de voix — à trancher pendant la Phase 3, avant la Phase 4.

**Chantiers non techniques** : voir `docs/LEGAL_COMPLIANCE.md`, douze points numérotés L1
à L12, avec pour chacun ce qu'il bloque. Ils peuvent avancer en parallèle des phases 1 à 3.

**Décisions ouvertes à ne pas combler par une hypothèse** :
- durées de conservation de la transcription, du résumé, des contacts, des journaux
  d'audit et des comptes résiliés (ADR-018) ;
- région d'hébergement des fournisseurs de téléphonie, de voix et d'IA — inconnue tant
  qu'ils ne sont pas choisis (ADR-017) ;
- région d'exécution du middleware Next.js sur le réseau de périphérie de Vercel : à
  vérifier et consigner avant production.

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
7. Indiquer clairement ce qui fonctionne réellement et ce qui attend une clé externe.
8. Proposer le message de commit.
9. **Attendre la validation avant la phase suivante.**
