# Base de données

Supabase PostgreSQL. Le schéma est **exclusivement** défini par les migrations de
`supabase/migrations/`. Aucune modification manuelle depuis le tableau de bord : la base
doit pouvoir être reconstruite à partir de zéro.

## Migrations de la Phase 0

| Fichier | Contenu |
|---|---|
| `0001_extensions_and_helpers` | extensions, `set_updated_at`, `normalize_phone`, `slugify` |
| `0002_core_identity` | `profiles`, `organizations`, `organization_members`, `organization_invitations` |
| `0003_activity_and_audit` | `activities`, `audit_logs` |
| `0004_authorization_functions` | `is_org_member`, `org_role`, `has_org_role`, `is_platform_admin`, `my_organizations`, `create_organization` |
| `0005_rls_policies` | activation de RLS et policies |
| `0006_audio_retention_policy` | enregistrement désactivé par défaut, rétention audio plafonnée à 30 jours, `audio_retention_events` |
| `0007_recording_notice_templates` | textes d'annonce par pays et langue, `resolve_recording_notice()`, `recording_allowed()` |
| `0008_test_organizations` | `is_test_organization`, trigger de garde, `call_is_test()` |
| `0009_profession_templates` | modèles de métier et catalogue de douze métiers |
| `0010_business_configuration` | `business_profiles`, `services`, `business_hours`, `absences` |
| `0011_sophie_configuration` | `sophie_configurations`, `business_knowledge`, `apply_profession_template()`, `set_onboarding_step()` |

## Vérifier ce qui est appliqué

`supabase/checks/01_verify_schema.sql` liste les objets attendus et signale ceux qui
manquent, avec le numéro de la migration concernée. `02_verify_content.sql` vérifie le
catalogue de métiers et les garde-fous de conformité. Les deux sont en lecture seule.

## Tables

### profiles
Miroir applicatif de `auth.users` (on n'ajoute jamais de colonne à `auth.users`).
Créé automatiquement par le trigger `on_auth_user_created`.
`is_platform_admin` ne peut pas être modifié par l'utilisateur : la policy UPDATE vérifie
que la valeur reste identique.

### organizations
Le tenant. `slug` unique généré par `slugify()` avec suffixe numérique en cas de
collision. `onboarding_step` pilote la reprise de l'onboarding. Suppression **logique**
par `deleted_at` : on ne détruit jamais l'historique d'une entreprise.

### organization_members
Source de vérité des autorisations. `unique (organization_id, user_id)`.
Le trigger `prevent_last_owner_removal` empêche de supprimer ou de rétrograder le dernier
`OWNER` actif d'une organisation.

### organization_invitations
Seul le **hash** du jeton est stocké. Index unique partiel : une seule invitation en
attente par couple (organisation, e-mail).

### activities
Fil d'événements lisible par le professionnel (fiche appel, fiche contact).
`correlation_id` permet de suivre un appel à travers tous les services.
Lecture par les membres ; **écriture serveur uniquement** — une activité doit refléter un
fait, jamais une affirmation venue du navigateur.

### audit_logs
Journal de sécurité : accès administratifs, écoute d'un enregistrement audio, changement
de rôle. `force row level security` et aucune policy pour `authenticated` : seul le rôle
`service_role` y accède. Les tenants ne le lisent jamais.

## Fonctions d'autorisation

Elles sont `SECURITY DEFINER` avec `search_path` figé. C'est nécessaire, pas un raccourci :
les policies de `organization_members` doivent interroger `organization_members`, ce qui
provoquerait une récursion infinie si la lecture passait par RLS.

Elles sont sûres parce qu'elles ne renvoient qu'un booléen ou le rôle de l'appelant, et
qu'elles filtrent toujours sur `auth.uid()`.

```sql
is_org_member(org_id)              -- membre actif ?
org_role(org_id)                   -- OWNER | ADMIN | MEMBER | null
has_org_role(org_id, allowed[])    -- l'un des rôles demandés ?
is_platform_admin()                -- console plateforme
my_organizations()                 -- organisations accessibles
create_organization(...)           -- crée organisation + OWNER + activité, en une transaction
```

`create_organization` existe pour résoudre un problème d'amorçage : on ne peut pas être
membre d'une organisation qui n'existe pas encore. Plutôt qu'ouvrir une policy INSERT
permissive sur `organizations`, la création passe par cette fonction unique.

## Règle absolue pour les phases suivantes

Toute nouvelle table portant un `organization_id` doit, **dans la même migration** :

1. activer RLS ;
2. déclarer une policy par opération utilisée ;
3. créer un index sur `(organization_id, …)` pour les requêtes de liste.

Une table sans policy est une fuite de données, pas un oubli mineur.

## Points de vigilance déjà identifiés pour la suite

- **Double réservation (Phase 3)** : la prévention se fait en base, pas dans le code
  applicatif ni dans l'IA. L'extension `btree_gist` est déjà installée en vue d'une
  contrainte d'exclusion sur un `tstzrange` de créneau, combinée à des `holds` avec
  expiration.
- **Recherche globale (Phase 2)** : prévoir `pg_trgm` et des index GIN sur nom, téléphone
  normalisé, entreprise et adresse.
- **Rétention audio (Phase 5)** : la politique de rétention est une colonne de
  configuration par organisation, jamais une constante dans le code.
