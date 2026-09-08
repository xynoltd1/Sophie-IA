-- =============================================================================
-- 0010 — Configuration de l entreprise
-- Phase 1 — profil, services, horaires, absences
-- =============================================================================

-- -----------------------------------------------------------------------------
-- business_profiles — une ligne par organisation
-- -----------------------------------------------------------------------------
create table public.business_profiles (
  organization_id         uuid primary key references public.organizations (id) on delete cascade,

  profession_template_id  uuid references public.profession_templates (id) on delete restrict,
  -- Renseigne uniquement quand le modele choisi autorise la saisie libre.
  custom_profession_label text,

  legal_name              text,
  contact_email           citext,
  contact_phone           text,
  contact_phone_e164      text,

  address_line1           text,
  address_line2           text,
  postal_code             text,
  city                    text,

  -- Zone d intervention. Deux expressions possibles, l entreprise choisit.
  service_area_description text,
  service_area_radius_km   int check (service_area_radius_km is null or service_area_radius_km between 1 and 500),

  website                 text,

  -- Regles d agenda, initialisees depuis le modele de metier.
  default_appointment_minutes int not null default 60 check (default_appointment_minutes between 5 and 1440),
  buffer_minutes              int not null default 15 check (buffer_minutes between 0 and 240),

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint business_profiles_profession_known check (
    profession_template_id is not null or custom_profession_label is not null
  )
);

comment on table public.business_profiles is
  'Identite et parametres metier d une organisation. Alimente les reponses de Sophie (section 9).';

create trigger business_profiles_set_updated_at
  before update on public.business_profiles
  for each row execute function public.set_updated_at();

-- Normalisation du telephone de contact, cote base pour rester coherent.
create or replace function public.business_profiles_normalize_phone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  calling_code text;
begin
  select o.country_calling_code into calling_code
  from public.organizations o where o.id = new.organization_id;

  new.contact_phone_e164 := public.normalize_phone(new.contact_phone, coalesce(calling_code, '32'));
  return new;
end;
$$;

create trigger business_profiles_phone
  before insert or update of contact_phone on public.business_profiles
  for each row execute function public.business_profiles_normalize_phone();

alter table public.business_profiles enable row level security;

create policy "profil: lecture par les membres"
  on public.business_profiles for select to authenticated
  using (public.is_org_member(organization_id));

create policy "profil: ecriture par OWNER et ADMIN"
  on public.business_profiles for all to authenticated
  using (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]));

-- -----------------------------------------------------------------------------
-- services
-- -----------------------------------------------------------------------------
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,

  name             text not null check (length(btrim(name)) between 2 and 120),
  description      text,
  duration_minutes int not null default 60 check (duration_minutes between 5 and 1440),
  is_urgent        boolean not null default false,
  is_active        boolean not null default true,

  -- Tarif volontairement en TEXTE : « a partir de 80 EUR », « sur devis ».
  -- Un nombre inviterait Sophie a calculer ; elle ne doit qu enoncer ce que
  -- l entreprise a ecrit (section 9).
  price_indication text,

  -- Informations que Sophie doit collecter pour ce service.
  collect_fields   jsonb not null default '[]'::jsonb,

  source           text not null default 'CUSTOM' check (source in ('TEMPLATE', 'CUSTOM')),
  sort_order       int not null default 100,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.services.price_indication is
  'Texte libre. Sophie enonce ce texte tel quel et ne calcule jamais un prix.';

create unique index services_unique_name_idx
  on public.services (organization_id, lower(btrim(name)));
create index services_active_idx
  on public.services (organization_id, sort_order) where is_active;

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

alter table public.services enable row level security;

create policy "services: lecture par les membres"
  on public.services for select to authenticated
  using (public.is_org_member(organization_id));

create policy "services: ecriture par OWNER et ADMIN"
  on public.services for all to authenticated
  using (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]));

-- -----------------------------------------------------------------------------
-- business_hours — une ligne par jour de la semaine
-- weekday : 1 = lundi … 7 = dimanche (ISO 8601, comme extract(isodow)).
-- -----------------------------------------------------------------------------
create table public.business_hours (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- null = horaires de l entreprise ; renseigne = horaires d un membre (section 36).
  member_id       uuid references public.organization_members (id) on delete cascade,

  weekday         int  not null check (weekday between 1 and 7),
  is_open         boolean not null default true,
  opens_at        time,
  closes_at       time,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint business_hours_coherent check (
    is_open = false
    or (opens_at is not null and closes_at is not null and opens_at < closes_at)
  )
);

create unique index business_hours_unique_idx
  on public.business_hours (organization_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid), weekday);

create trigger business_hours_set_updated_at
  before update on public.business_hours
  for each row execute function public.set_updated_at();

alter table public.business_hours enable row level security;

create policy "horaires: lecture par les membres"
  on public.business_hours for select to authenticated
  using (public.is_org_member(organization_id));

create policy "horaires: ecriture par OWNER et ADMIN"
  on public.business_hours for all to authenticated
  using (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]));

-- -----------------------------------------------------------------------------
-- absences — conges et indisponibilites
-- Sophie ne doit jamais proposer une date situee dans une absence (section 29).
-- -----------------------------------------------------------------------------
create table public.absences (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id       uuid references public.organization_members (id) on delete cascade,

  kind            text not null default 'ABSENCE' check (kind in ('VACATION', 'ABSENCE', 'HOLIDAY')),
  label           text,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,

  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint absences_coherent check (ends_at > starts_at)
);

create index absences_window_idx on public.absences (organization_id, starts_at, ends_at);

create trigger absences_set_updated_at
  before update on public.absences
  for each row execute function public.set_updated_at();

alter table public.absences enable row level security;

create policy "absences: lecture par les membres"
  on public.absences for select to authenticated
  using (public.is_org_member(organization_id));

create policy "absences: ecriture par OWNER et ADMIN"
  on public.absences for all to authenticated
  using (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]));
