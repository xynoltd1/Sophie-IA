-- =============================================================================
-- 0002 — Identite, organisations, membres
-- Phase 0 — fondations multi-tenant
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.member_role   as enum ('OWNER', 'ADMIN', 'MEMBER');
create type public.member_status as enum ('INVITED', 'ACTIVE', 'SUSPENDED');

-- Etapes d onboarding (section 6 du cahier des charges).
-- L ordre de l enum sert a calculer la progression.
create type public.onboarding_step as enum (
  'ORGANIZATION',   -- identite entreprise
  'PROFESSION',     -- metier
  'SERVICES',       -- services proposes
  'SCHEDULE',       -- horaires
  'CALENDAR',       -- connexion Google Calendar
  'SOPHIE',         -- configuration de l assistante
  'PHONE',          -- regles de prise d appel
  'DONE'
);

-- -----------------------------------------------------------------------------
-- profiles — miroir applicatif de auth.users
-- auth.users appartient a Supabase ; on n y ajoute jamais de colonne metier.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text,
  phone             text,
  avatar_url        text,
  locale            text        not null default 'fr',
  -- Acces a la console d administration de la plateforme (section 37).
  -- Ne peut jamais etre modifie par l utilisateur : voir policies en 0004.
  is_platform_admin boolean     not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is
  'Donnees applicatives d un utilisateur authentifie. Cle primaire = auth.users.id.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creation automatique du profil a l inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- organizations — l entite centrale du multi-tenant (section 4)
-- -----------------------------------------------------------------------------
create table public.organizations (
  id                      uuid primary key default gen_random_uuid(),
  name                    text        not null check (length(btrim(name)) between 2 and 120),
  slug                    citext      not null unique,

  -- Localisation : jamais de constante codee en dur dans le code applicatif.
  country_code            text        not null default 'BE' check (country_code ~ '^[A-Z]{2}$'),
  country_calling_code    text        not null default '32' check (country_calling_code ~ '^[0-9]{1,4}$'),
  timezone                text        not null default 'Europe/Brussels',
  locale                  text        not null default 'fr',
  currency                text        not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),

  -- Onboarding reprenable (section 6).
  onboarding_step         public.onboarding_step not null default 'ORGANIZATION',
  onboarding_completed_at timestamptz,

  created_by              uuid references auth.users (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- Suppression logique : on ne detruit pas l historique d une organisation.
  deleted_at              timestamptz
);

comment on table public.organizations is
  'Tenant. Toute donnee metier porte un organization_id et est isolee par RLS.';

create index organizations_created_by_idx on public.organizations (created_by);
create index organizations_active_idx     on public.organizations (id) where deleted_at is null;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- organization_members — appartenance et role (section 5)
-- -----------------------------------------------------------------------------
create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            public.member_role   not null default 'MEMBER',
  status          public.member_status not null default 'ACTIVE',
  job_title       text,
  invited_by      uuid references auth.users (id) on delete set null,
  joined_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

comment on table public.organization_members is
  'Lien utilisateur <-> organisation. Source de verite des autorisations RLS.';

create index organization_members_user_idx on public.organization_members (user_id, status);
create index organization_members_org_idx  on public.organization_members (organization_id, status);

create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

-- Garde-fou : une organisation conserve toujours au moins un OWNER actif.
create or replace function public.prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  loses_ownership boolean;
  remaining       int;
begin
  loses_ownership :=
    old.role = 'OWNER'
    and (
      tg_op = 'DELETE'
      or new.role <> 'OWNER'
      or new.status <> 'ACTIVE'
    );

  if not loses_ownership then
    return coalesce(new, old);
  end if;

  select count(*) into remaining
  from public.organization_members m
  where m.organization_id = old.organization_id
    and m.role   = 'OWNER'
    and m.status = 'ACTIVE'
    and m.id <> old.id;

  if remaining = 0 then
    raise exception 'Une organisation doit conserver au moins un proprietaire actif.'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger organization_members_protect_owner
  before update or delete on public.organization_members
  for each row execute function public.prevent_last_owner_removal();

-- -----------------------------------------------------------------------------
-- organization_invitations — preparation de l equipe (section 36)
-- -----------------------------------------------------------------------------
create table public.organization_invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid   not null references public.organizations (id) on delete cascade,
  email           citext not null,
  role            public.member_role not null default 'MEMBER',
  token_hash      text   not null unique,
  invited_by      uuid references auth.users (id) on delete set null,
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);

create unique index organization_invitations_pending_idx
  on public.organization_invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;

comment on column public.organization_invitations.token_hash is
  'Hash du jeton d invitation. Le jeton en clair n est jamais stocke.';
