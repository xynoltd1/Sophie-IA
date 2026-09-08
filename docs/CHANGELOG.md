# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Versionnement sémantique.

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
