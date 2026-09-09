-- =============================================================================
-- 0013 — CRM : contacts, prospects, taches
-- Phase 2 — sections 17, 28, 32 et 33
--
-- Distinction fondamentale (section 17) : un Contact est une PERSONNE connue,
-- un Lead est une DEMANDE commerciale. Un contact peut avoir plusieurs leads
-- dans le temps — le meme plombier rappelle six mois plus tard pour autre chose.
-- Les confondre rendrait l historique client inexploitable.
-- =============================================================================

create extension if not exists "pg_trgm" with schema extensions;  -- recherche floue (section 33)

create type public.lead_status as enum (
  'NEW',          -- Nouveau
  'QUALIFIED',    -- A traiter
  'APPOINTMENT',  -- RDV / Devis
  'CUSTOMER',     -- Client
  'WON',          -- Termine
  'LOST'          -- Perdu
);

create type public.lead_priority as enum ('LOW', 'NORMAL', 'HIGH', 'URGENT');
create type public.task_status   as enum ('OPEN', 'DONE', 'CANCELLED');
create type public.entity_source as enum ('MANUAL', 'SOPHIE', 'SYSTEM');

-- -----------------------------------------------------------------------------
-- contacts
-- -----------------------------------------------------------------------------
create table public.contacts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  full_name       text,
  company_name    text,
  email           citext,

  phone           text,
  -- Cle de deduplication. Calculee par trigger a partir de l indicatif du pays
  -- de l organisation : « 0470 12 34 56 » et « +32470123456 » sont le meme
  -- client, et Sophie doit le reconnaitre au deuxieme appel.
  phone_e164      text,

  address_line1   text,
  postal_code     text,
  city            text,

  notes           text,
  source          public.entity_source not null default 'MANUAL',

  -- Cree automatiquement pendant un appel, avant d avoir un nom.
  is_provisional  boolean not null default false,

  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Un contact sans aucun moyen de le joindre ni de le nommer n a pas de sens.
  constraint contacts_identifiable check (
    full_name is not null or company_name is not null or phone is not null
  )
);

comment on table public.contacts is
  'Personne ou entreprise connue. Distincte d un lead, qui est une demande.';

-- Deduplication : un seul contact par numero dans une organisation.
create unique index contacts_phone_unique_idx
  on public.contacts (organization_id, phone_e164)
  where phone_e164 is not null;

create index contacts_org_idx on public.contacts (organization_id, updated_at desc);

-- Recherche globale par nom, entreprise, ville (section 33).
create index contacts_search_idx on public.contacts
  using gin ((coalesce(full_name, '') || ' ' || coalesce(company_name, '') || ' ' || coalesce(city, '')) extensions.gin_trgm_ops);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

create or replace function public.contacts_normalize_phone()
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

  new.phone_e164 := public.normalize_phone(new.phone, coalesce(calling_code, '32'));
  return new;
end;
$$;

create trigger contacts_phone
  before insert or update of phone on public.contacts
  for each row execute function public.contacts_normalize_phone();

alter table public.contacts enable row level security;
grant select, insert, update, delete on public.contacts to authenticated;

create policy "contacts: lecture par les membres"
  on public.contacts for select to authenticated
  using (public.is_org_member(organization_id));

create policy "contacts: ecriture par les membres"
  on public.contacts for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- -----------------------------------------------------------------------------
-- leads
-- -----------------------------------------------------------------------------
create table public.leads (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contact_id      uuid references public.contacts (id) on delete set null,
  service_id      uuid references public.services (id) on delete set null,

  title           text not null check (length(btrim(title)) between 2 and 200),
  description     text,

  status          public.lead_status   not null default 'NEW',
  priority        public.lead_priority not null default 'NORMAL',

  -- Adresse d intervention : elle peut differer de l adresse du contact.
  address_line1   text,
  postal_code     text,
  city            text,

  requested_at    timestamptz,  -- date souhaitee par le client
  source          public.entity_source not null default 'MANUAL',

  -- Renseigne quand le lead sort du pipeline, pour comprendre les pertes.
  closed_at       timestamptz,
  close_reason    text,

  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint leads_closed_coherent check (
    (status in ('WON', 'LOST')) = (closed_at is not null)
  )
);

comment on table public.leads is
  'Demande commerciale. Un contact peut en avoir plusieurs dans le temps.';

create index leads_pipeline_idx on public.leads (organization_id, status, updated_at desc);
create index leads_contact_idx  on public.leads (contact_id, created_at desc);
create index leads_urgent_idx   on public.leads (organization_id, priority)
  where priority = 'URGENT' and status not in ('WON', 'LOST');

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- Horodatage automatique de la cloture : la contrainte ci-dessus l exige, et
-- l oublier cote application produirait une erreur incomprehensible.
create or replace function public.leads_stamp_closure()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('WON', 'LOST') and new.closed_at is null then
    new.closed_at := now();
  elsif new.status not in ('WON', 'LOST') then
    new.closed_at := null;
    new.close_reason := null;
  end if;
  return new;
end;
$$;

create trigger leads_closure
  before insert or update of status on public.leads
  for each row execute function public.leads_stamp_closure();

alter table public.leads enable row level security;
grant select, insert, update, delete on public.leads to authenticated;

create policy "prospects: lecture par les membres"
  on public.leads for select to authenticated
  using (public.is_org_member(organization_id));

create policy "prospects: ecriture par les membres"
  on public.leads for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- -----------------------------------------------------------------------------
-- tasks — section 28
-- « Demandez-lui de me rappeler demain matin. » doit devenir une tache.
-- -----------------------------------------------------------------------------
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  title           text not null check (length(btrim(title)) between 2 and 200),
  description     text,

  assigned_to     uuid references public.organization_members (id) on delete set null,
  contact_id      uuid references public.contacts (id) on delete cascade,
  lead_id         uuid references public.leads (id) on delete cascade,

  due_at          timestamptz,
  priority        public.lead_priority not null default 'NORMAL',
  status          public.task_status   not null default 'OPEN',
  source          public.entity_source not null default 'MANUAL',

  completed_at    timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Les taches en retard alimentent le bloc « A traiter » de l accueil.
create index tasks_due_idx on public.tasks (organization_id, due_at)
  where status = 'OPEN';
create index tasks_contact_idx on public.tasks (contact_id) where contact_id is not null;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create or replace function public.tasks_stamp_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'DONE' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'DONE' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_completion
  before insert or update of status on public.tasks
  for each row execute function public.tasks_stamp_completion();

alter table public.tasks enable row level security;
grant select, insert, update, delete on public.tasks to authenticated;

create policy "taches: lecture par les membres"
  on public.tasks for select to authenticated
  using (public.is_org_member(organization_id));

create policy "taches: ecriture par les membres"
  on public.tasks for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
