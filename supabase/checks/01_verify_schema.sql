-- =============================================================================
-- Verification de l etat du schema
--
-- Script en LECTURE SEULE. A coller dans l editeur SQL de Supabase.
-- Il ne modifie rien : il compare ce qui existe a ce qui devrait exister
-- apres les onze migrations, et signale ce qui manque.
--
-- Lecture du resultat : la colonne "etat" vaut OK ou MANQUANT.
-- Tout ce qui est MANQUANT correspond a une migration non appliquee.
-- =============================================================================

with attendu_tables (migration, objet) as (
  values
    ('0002', 'profiles'),
    ('0002', 'organizations'),
    ('0002', 'organization_members'),
    ('0002', 'organization_invitations'),
    ('0003', 'activities'),
    ('0003', 'audit_logs'),
    ('0006', 'audio_retention_events'),
    ('0007', 'recording_notice_templates'),
    ('0009', 'profession_templates'),
    ('0010', 'business_profiles'),
    ('0010', 'services'),
    ('0010', 'business_hours'),
    ('0010', 'absences'),
    ('0011', 'sophie_configurations'),
    ('0017', 'calendar_busy_blocks'),
    ('0011', 'business_knowledge')
),
attendu_fonctions (migration, objet) as (
  values
    ('0001', 'set_updated_at'),
    ('0001', 'normalize_phone'),
    ('0001', 'slugify'),
    ('0004', 'is_org_member'),
    ('0004', 'org_role'),
    ('0004', 'has_org_role'),
    ('0004', 'is_platform_admin'),
    ('0004', 'my_organizations'),
    ('0004', 'create_organization'),
    ('0007', 'resolve_recording_notice'),
    ('0007', 'recording_allowed'),
    ('0008', 'call_is_test'),
    ('0011', 'apply_profession_template'),
    ('0017', 'calendar_sync_state'),
    ('0011', 'set_onboarding_step')
),
attendu_colonnes (migration, objet) as (
  values
    ('0006', 'organizations.audio_retention_days'),
    ('0006', 'organizations.recording_enabled'),
    ('0008', 'organizations.is_test_organization'),
    ('0017', 'calendar_connections.sync_token'),
    ('0017', 'calendar_connections.consecutive_failures'),
    ('0017', 'appointments.external_sync_error'),
    ('0017', 'appointments.external_synced_at')
)

-- 1. Tables
select
  a.migration,
  'table'::text                              as categorie,
  a.objet,
  case when t.tablename is null then 'MANQUANT' else 'OK' end as etat
from attendu_tables a
left join pg_tables t
  on t.schemaname = 'public' and t.tablename = a.objet

union all

-- 2. Fonctions
select
  a.migration,
  'fonction',
  a.objet,
  case when p.proname is null then 'MANQUANT' else 'OK' end
from attendu_fonctions a
left join (
  select distinct pr.proname
  from pg_proc pr
  join pg_namespace n on n.oid = pr.pronamespace
  where n.nspname = 'public'
) p on p.proname = a.objet

union all

-- 3. Colonnes ajoutees par les migrations d amendement
select
  a.migration,
  'colonne',
  a.objet,
  case when c.column_name is null then 'MANQUANT' else 'OK' end
from attendu_colonnes a
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name   = split_part(a.objet, '.', 1)
 and c.column_name  = split_part(a.objet, '.', 2)

union all

-- 4. Controle de securite : toute table publique doit avoir RLS active
select
  '—',
  'securite',
  'RLS desactive sur ' || c.relname,
  'MANQUANT'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false

union all

-- 5. Controle de securite : une table avec RLS mais sans policy est inaccessible
--    (ou pire, revele une migration a moitie appliquee)
select
  '—',
  'securite',
  'aucune policy sur ' || c.relname,
  'MANQUANT'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = true
  and not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname
  )
  -- audit_logs n a volontairement aucune policy : acces service_role uniquement.
  and c.relname <> 'audit_logs'

union all

-- 6. Controle de securite : une table avec des policies mais sans privilege
--    est totalement inaccessible. Postgres verifie le GRANT AVANT la policy.
--    Symptome : « permission denied for table X » meme sur ses propres donnees.
select
  '0012',
  'privilege',
  'authenticated ne peut pas lire ' || c.relname,
  'MANQUANT'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname <> 'audit_logs'   -- volontairement inaccessible aux tenants
  and exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname and p.cmd in ('SELECT', 'ALL')
  )
  and not has_table_privilege('authenticated', c.oid, 'SELECT')
  -- Un privilege accorde COLONNE PAR COLONNE ne compte pas comme un privilege
  -- de table : has_table_privilege renvoie faux alors que la table est bel et
  -- bien lisible. C est le cas de calendar_connections depuis la migration
  -- 0017, ou seules les colonnes non sensibles sont accordees.
  -- Sans cette exception, le controle signalait une faille inexistante.
  and not exists (
    select 1
    from information_schema.columns col
    where col.table_schema = 'public'
      and col.table_name = c.relname
      and has_column_privilege('authenticated', c.oid, col.column_name, 'SELECT')
  )

union all

-- 7. Controle de securite : les jetons d agenda ne doivent JAMAIS etre lisibles
--    par un utilisateur connecte. C est la faille corrigee par la migration
--    0017 : la 0016 accordait select sur toute la table, jetons compris.
--
--    Une ligne ici signifie qu un membre connecte peut lire le jeton de
--    rafraichissement Google de son organisation.
select
  '0017',
  'securite',
  'authenticated peut lire calendar_connections.' || c.column_name,
  'MANQUANT'
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'calendar_connections'
  and c.column_name in ('access_token', 'refresh_token')
  and has_column_privilege('authenticated', 'public.calendar_connections', c.column_name, 'SELECT')

order by 1, 2, 3;
