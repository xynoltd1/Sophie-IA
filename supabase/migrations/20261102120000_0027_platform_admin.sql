-- =============================================================================
-- 0027 — Administration de la plateforme (Phase 7, sections 37 et 38)
--
-- Ce que cette migration ajoute : de quoi exploiter Sophie comme un service,
-- et non comme une application mono-client.
--
--   plans            les offres commerciales
--   subscriptions    ce qu une entreprise a souscrit
--   usage_records    ce qu elle a consomme
--   provider_errors  ce qui casse chez les fournisseurs, pour le voir venir
--
-- Deux principes de securite gouvernent le tout.
--
-- **Le super administrateur n est pas un membre.** Son acces passe par
-- `is_platform_admin()`, jamais par `is_org_member()`. Les deux chemins
-- d autorisation restent separes : melanger les deux ferait qu une faille dans
-- l un ouvrirait l autre.
--
-- **Il n a pas acces aux audios.** Section 37, explicitement. Les
-- enregistrements sont la voix de clients qui n ont jamais consenti a ce qu un
-- editeur de logiciel les ecoute. Aucune policy de cette migration ne touche a
-- `calls.recording_path`, et l acces reste reserve aux membres de
-- l organisation.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- plans
-- -----------------------------------------------------------------------------
create table if not exists public.plans (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique check (code ~ '^[A-Z][A-Z0-9_]{1,30}$'),
  label                   text not null,
  description             text,

  -- En centimes : jamais de flottant pour de l argent.
  -- Null = tarif non encore fixe. Le cahier des charges demande de ne pas
  -- inventer de prix (section 38).
  monthly_price_cents     int check (monthly_price_cents is null or monthly_price_cents >= 0),
  currency                text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),

  included_voice_minutes  int not null default 0 check (included_voice_minutes >= 0),
  included_sms            int not null default 0 check (included_sms >= 0),
  max_members             int check (max_members is null or max_members >= 1),

  is_public               boolean not null default false,
  sort_order              int not null default 100,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

comment on table public.plans is
  'Offres commerciales. Un prix null signifie « pas encore fixe », et non « gratuit ».';

-- Les trois categories prevues par la section 38. Prix volontairement absents.
insert into public.plans (code, label, description, included_voice_minutes, included_sms, max_members, sort_order)
values
  ('SOLO',   'Solo',   'Un artisan seul.',                    200,  100, 1, 10),
  ('PRO',    'Pro',    'Un artisan avec plus de volume.',      500,  300, 3, 20),
  ('EQUIPE', 'Équipe', 'Plusieurs intervenants, un agenda.',  1500, 1000, 10, 30)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- subscriptions
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum (
      'TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'SUSPENDED'
    );
  end if;
end
$$;

create table if not exists public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_id         uuid not null references public.plans (id) on delete restrict,

  status          public.subscription_status not null default 'TRIAL',
  period_start    timestamptz not null default now(),
  period_end      timestamptz,
  cancel_at       timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Un seul abonnement vivant par entreprise. Deux abonnements actifs
-- factureraient deux fois et compteraient les quotas deux fois.
create unique index if not exists subscriptions_active_idx
  on public.subscriptions (organization_id)
  where status in ('TRIAL', 'ACTIVE', 'PAST_DUE');

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- usage_records
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'usage_kind') then
    create type public.usage_kind as enum ('VOICE_MINUTES', 'SMS_SENT', 'AI_USAGE', 'STORAGE');
  end if;
end
$$;

create table if not exists public.usage_records (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  kind            public.usage_kind not null,
  -- Numeric et non int : les minutes de voix se comptent en fractions.
  quantity        numeric(12, 3) not null check (quantity >= 0),

  call_id         uuid references public.calls (id) on delete set null,
  message_id      uuid references public.outbound_messages (id) on delete set null,

  -- Un appel ne doit etre compte qu une fois, meme si son webhook est rejoue.
  dedupe_key      text,

  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create unique index if not exists usage_records_dedupe_idx
  on public.usage_records (organization_id, kind, dedupe_key)
  where dedupe_key is not null;
create index if not exists usage_records_org_period_idx
  on public.usage_records (organization_id, kind, occurred_at desc);

comment on table public.usage_records is
  'Consommation facturable. `dedupe_key` empeche de compter deux fois un webhook rejoue.';

-- -----------------------------------------------------------------------------
-- provider_errors
-- -----------------------------------------------------------------------------
create table if not exists public.provider_errors (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,

  provider        text not null,
  operation       text not null,
  message         text not null,
  correlation_id  uuid,

  occurred_at     timestamptz not null default now()
);

create index if not exists provider_errors_recent_idx
  on public.provider_errors (provider, occurred_at desc);

comment on table public.provider_errors is
  'Pannes des services externes. Sert a distinguer « notre code a un bug » de « le fournisseur est tombe ».';

-- -----------------------------------------------------------------------------
-- RLS
--
-- Deux publics, deux chemins. Une entreprise voit SON abonnement et SA
-- consommation. Le super administrateur voit tout, sauf les audios.
-- -----------------------------------------------------------------------------
alter table public.plans           enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.usage_records   enable row level security;
alter table public.provider_errors enable row level security;

drop policy if exists "plans: lecture des offres publiques" on public.plans;
create policy "plans: lecture des offres publiques"
  on public.plans for select to authenticated
  using (is_public or public.is_platform_admin());

drop policy if exists "plans: administration plateforme" on public.plans;
create policy "plans: administration plateforme"
  on public.plans for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "abonnements: lecture par l entreprise" on public.subscriptions;
create policy "abonnements: lecture par l entreprise"
  on public.subscriptions for select to authenticated
  using (public.is_org_member(organization_id) or public.is_platform_admin());

drop policy if exists "abonnements: administration plateforme" on public.subscriptions;
create policy "abonnements: administration plateforme"
  on public.subscriptions for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "usage: lecture par l entreprise" on public.usage_records;
create policy "usage: lecture par l entreprise"
  on public.usage_records for select to authenticated
  using (public.is_org_member(organization_id) or public.is_platform_admin());

drop policy if exists "erreurs fournisseurs: plateforme" on public.provider_errors;
create policy "erreurs fournisseurs: plateforme"
  on public.provider_errors for select to authenticated
  using (public.is_platform_admin());

grant select                         on public.plans           to authenticated;
grant insert, update, delete         on public.plans           to authenticated;
grant select, insert, update, delete on public.subscriptions   to authenticated;
grant select                         on public.usage_records   to authenticated;
grant select                         on public.provider_errors to authenticated;

-- -----------------------------------------------------------------------------
-- Les metiers, modifiables depuis l administration (section 37)
--
-- La table existe depuis la migration 0009, sans policy d ecriture : seul le
-- code pouvait la remplir. Le cahier des charges demande de pouvoir creer
-- « Vitrier » sans toucher au code.
-- -----------------------------------------------------------------------------
drop policy if exists "metiers: administration plateforme" on public.profession_templates;
create policy "metiers: administration plateforme"
  on public.profession_templates for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant insert, update, delete on public.profession_templates to authenticated;

-- -----------------------------------------------------------------------------
-- Vue d ensemble de la plateforme
--
-- Reservee aux administrateurs de la plateforme, et la fonction le verifie
-- elle-meme : un GRANT ne suffit pas, puisqu elle est SECURITY DEFINER.
-- -----------------------------------------------------------------------------
create or replace function public.platform_overview()
returns table (
  organizations_total   int,
  organizations_active  int,
  calls_7d              int,
  appointments_pending   int,
  provider_errors_24h   int,
  messages_failed       int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Reserve a l administration de la plateforme.' using errcode = '42501';
  end if;

  return query
  select
    (select count(*)::int from public.organizations where deleted_at is null),
    (select count(*)::int from public.organizations
      where deleted_at is null and onboarding_step = 'DONE'),
    (select count(*)::int from public.calls
      where started_at > now() - interval '7 days' and is_test = false),
    (select count(*)::int from public.appointments where status = 'PENDING_APPROVAL'),
    (select count(*)::int from public.provider_errors
      where occurred_at > now() - interval '24 hours'),
    (select count(*)::int from public.outbound_messages where status = 'FAILED');
end;
$$;

grant execute on function public.platform_overview() to authenticated;

-- -----------------------------------------------------------------------------
-- Consommation d une organisation sur une periode
-- -----------------------------------------------------------------------------
create or replace function public.usage_summary(org_id uuid, depuis timestamptz default null)
returns table (kind public.usage_kind, total numeric)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_org_member(org_id) or public.is_platform_admin()) then
    raise exception 'Droits insuffisants.' using errcode = '42501';
  end if;

  return query
  select u.kind, sum(u.quantity)::numeric
  from public.usage_records u
  where u.organization_id = org_id
    and u.occurred_at >= coalesce(depuis, date_trunc('month', now()))
  group by u.kind;
end;
$$;

grant execute on function public.usage_summary(uuid, timestamptz) to authenticated;
