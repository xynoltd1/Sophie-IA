-- =============================================================================
-- 0003 — Activites metier et journal d audit
-- Phase 0 — section 35 du cahier des charges
--
-- Trois journaux distincts, volontairement separes :
--   public.activities  -> fil d evenements lisible par le professionnel
--   public.audit_logs  -> traces de securite / acces sensibles (jamais visibles
--                         par le tenant, reservees a la plateforme)
--   logs techniques    -> hors base (plateforme d observabilite, Phase 8)
-- =============================================================================

create table public.activities (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  -- Qui : soit un membre, soit Sophie, soit le systeme.
  actor_user_id   uuid references auth.users (id) on delete set null,
  actor_kind      text not null default 'USER'
                    check (actor_kind in ('USER', 'SOPHIE', 'SYSTEM', 'CUSTOMER')),

  -- Quoi : type libre mais contraint par convention MAJUSCULES_SNAKE.
  type            text not null check (type ~ '^[A-Z][A-Z0-9_]{2,63}$'),

  -- Sur quoi : reference souple, les tables cibles arrivent aux phases suivantes.
  subject_type    text,
  subject_id      uuid,

  summary         text not null,
  metadata        jsonb not null default '{}'::jsonb,

  -- Identifiant de correlation pour suivre un appel a travers les services
  -- (section 54).
  correlation_id  uuid,

  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

comment on table public.activities is
  'Fil d activite metier affiche dans l application (fiche contact, fiche appel).';

create index activities_org_time_idx    on public.activities (organization_id, occurred_at desc);
create index activities_subject_idx     on public.activities (organization_id, subject_type, subject_id);
create index activities_correlation_idx on public.activities (correlation_id) where correlation_id is not null;

-- -----------------------------------------------------------------------------
-- audit_logs — traces de securite
-- Ecrites uniquement cote serveur (service role). Aucun tenant ne les lit.
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id              bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete set null,
  actor_user_id   uuid references auth.users (id) on delete set null,
  action          text not null,
  resource_type   text,
  resource_id     text,
  ip_address      inet,
  user_agent      text,
  outcome         text not null default 'SUCCESS' check (outcome in ('SUCCESS', 'DENIED', 'ERROR')),
  details         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

comment on table public.audit_logs is
  'Journal de securite : acces administratifs, acces aux enregistrements audio, changements de role. Non expose aux tenants.';

create index audit_logs_org_time_idx   on public.audit_logs (organization_id, created_at desc);
create index audit_logs_actor_time_idx on public.audit_logs (actor_user_id, created_at desc);
create index audit_logs_action_idx     on public.audit_logs (action, created_at desc);
