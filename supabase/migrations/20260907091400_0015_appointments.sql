-- =============================================================================
-- 0015 — Rendez-vous, holds et prevention de la double reservation
-- Phase 3 — sections 20, 21 et 22
--
-- LE POINT CENTRAL DE CETTE MIGRATION : deux appels simultanes ne doivent jamais
-- pouvoir confirmer le meme creneau. La garantie est une CONTRAINTE D EXCLUSION
-- PostgreSQL, pas une verification applicative.
--
-- Pourquoi : une verification en deux temps — « est-ce libre ? » puis
-- « alors je reserve » — laisse une fenetre entre les deux. Deux clients au
-- telephone en meme temps la traversent. La contrainte d exclusion ferme cette
-- fenetre au niveau de la base : la seconde insertion echoue, quoi qu il arrive.
--
-- L IA n est JAMAIS le verrou (section 20).
-- =============================================================================

create type public.appointment_status as enum (
  'HELD',              -- creneau bloque pendant la conversation, expire
  'PENDING_APPROVAL',  -- Sophie a propose, le professionnel doit valider
  'CONFIRMED',
  'CHANGE_PROPOSED',   -- nouvel horaire propose, en attente du client
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW'
);

create table public.appointments (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,

  contact_id         uuid references public.contacts (id) on delete set null,
  lead_id            uuid references public.leads (id) on delete set null,
  service_id         uuid references public.services (id) on delete set null,
  -- null = rendez-vous de l entreprise, sans intervenant designe.
  assigned_member_id uuid references public.organization_members (id) on delete set null,

  title              text not null check (length(btrim(title)) between 2 and 200),
  notes              text,

  starts_at          timestamptz not null,
  ends_at            timestamptz not null,

  -- Colonne calculee : c est elle que la contrainte d exclusion compare.
  -- Bornes [) : un rendez-vous de 9h a 10h et un autre de 10h a 11h ne se
  -- chevauchent pas.
  slot               tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,

  status             public.appointment_status not null default 'PENDING_APPROVAL',

  -- Un hold expire. Sans expiration, un appel interrompu bloquerait un creneau
  -- indefiniment (section 20).
  hold_expires_at    timestamptz,

  address_line1      text,
  postal_code        text,
  city               text,

  -- Renseigne quand l evenement existe chez le fournisseur d agenda (Phase 3+).
  external_event_id  text,
  external_provider  text,

  source             public.entity_source not null default 'MANUAL',
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint appointments_coherent check (ends_at > starts_at),
  constraint appointments_hold_expires check (
    (status = 'HELD') = (hold_expires_at is not null)
  )
);

comment on table public.appointments is
  'Rendez-vous et creneaux bloques. La non-superposition est garantie par contrainte, pas par le code.';

-- -----------------------------------------------------------------------------
-- LA contrainte
--
-- Deux rendez-vous actifs de la meme organisation et du meme intervenant ne
-- peuvent pas se chevaucher. Les statuts termines (annule, refuse, honore) ne
-- bloquent rien : on garde l historique sans bloquer l agenda.
--
-- L intervenant non designe est traite comme un intervenant a part entiere, via
-- un UUID nul : sinon deux rendez-vous « entreprise » pourraient se superposer.
-- -----------------------------------------------------------------------------
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    organization_id with =,
    coalesce(assigned_member_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    slot with &&
  )
  where (status in ('HELD', 'PENDING_APPROVAL', 'CONFIRMED', 'CHANGE_PROPOSED'));

create index appointments_org_time_idx on public.appointments (organization_id, starts_at);
create index appointments_contact_idx  on public.appointments (contact_id, starts_at desc);
create index appointments_pending_idx  on public.appointments (organization_id, starts_at)
  where status = 'PENDING_APPROVAL';
create index appointments_holds_idx    on public.appointments (hold_expires_at)
  where status = 'HELD';

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;
grant select, insert, update, delete on public.appointments to authenticated;

create policy "rendez-vous: lecture par les membres"
  on public.appointments for select to authenticated
  using (public.is_org_member(organization_id));

create policy "rendez-vous: ecriture par les membres"
  on public.appointments for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- -----------------------------------------------------------------------------
-- Liberation des holds expires
--
-- Appelee avant toute reservation, et par un job planifie en Phase 5. Un hold
-- expire devient REJECTED plutot que d etre supprime : on garde la trace d une
-- conversation qui n a pas abouti.
-- -----------------------------------------------------------------------------
create or replace function public.release_expired_holds(org_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  liberes int;
begin
  update public.appointments a
  set status = 'REJECTED',
      hold_expires_at = null
  where a.status = 'HELD'
    and a.hold_expires_at < now()
    and (org_id is null or a.organization_id = org_id);

  get diagnostics liberes = row_count;
  return liberes;
end;
$$;

grant execute on function public.release_expired_holds(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Reservation d un creneau
--
-- Le chemin unique par lequel un rendez-vous est cree. La contrainte
-- d exclusion fait le travail ; cette fonction traduit son echec en message
-- comprehensible plutot qu en erreur Postgres brute.
-- -----------------------------------------------------------------------------
create or replace function public.book_appointment(
  org_id        uuid,
  titre         text,
  debut         timestamptz,
  fin           timestamptz,
  contact       uuid default null,
  lead          uuid default null,
  service       uuid default null,
  intervenant   uuid default null,
  statut        public.appointment_status default 'CONFIRMED',
  duree_hold    interval default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  nouveau uuid;
begin
  if not public.is_org_member(org_id) then
    raise exception 'Droits insuffisants.' using errcode = '42501';
  end if;

  if fin <= debut then
    raise exception 'La fin du rendez-vous doit suivre son debut.' using errcode = 'check_violation';
  end if;

  -- Un creneau tenu par un appel abandonne ne doit pas bloquer une reservation.
  perform public.release_expired_holds(org_id);

  begin
    insert into public.appointments (
      organization_id, title, starts_at, ends_at, contact_id, lead_id, service_id,
      assigned_member_id, status, hold_expires_at, created_by
    )
    values (
      org_id, btrim(titre), debut, fin, contact, lead, service,
      intervenant, statut,
      case when statut = 'HELD' then now() + coalesce(duree_hold, interval '10 minutes') end,
      (select auth.uid())
    )
    returning id into nouveau;
  exception
    when exclusion_violation then
      -- Deux reservations simultanees : la seconde arrive ici. C est le
      -- comportement voulu, et la preuve que le verrou est en base.
      raise exception 'Ce creneau vient d etre pris.' using errcode = 'unique_violation';
  end;

  insert into public.activities (organization_id, actor_user_id, type, subject_type, subject_id, summary)
  values (org_id, (select auth.uid()), 'APPOINTMENT_CREATED', 'appointment', nouveau,
          btrim(titre) || ' — ' || to_char(debut, 'DD/MM/YYYY HH24:MI'));

  return nouveau;
end;
$$;

grant execute on function public.book_appointment(uuid, text, timestamptz, timestamptz, uuid, uuid, uuid, uuid, public.appointment_status, interval) to authenticated;

-- -----------------------------------------------------------------------------
-- Changement de statut
--
-- Un rendez-vous annule n est jamais supprime (section 21) : l historique doit
-- pouvoir repondre a « qu est-ce qui s est passe avec ce client ».
-- -----------------------------------------------------------------------------
create or replace function public.set_appointment_status(
  rdv_id  uuid,
  statut  public.appointment_status,
  motif   text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org_id uuid;
  titre  text;
begin
  select a.organization_id, a.title into org_id, titre
  from public.appointments a where a.id = rdv_id;

  if org_id is null or not public.is_org_member(org_id) then
    raise exception 'Rendez-vous introuvable.' using errcode = 'no_data_found';
  end if;

  begin
    update public.appointments a
    set status = statut,
        hold_expires_at = case when statut = 'HELD' then a.hold_expires_at end,
        notes = coalesce(
          case when motif is not null
               then coalesce(a.notes || E'\n', '') || motif
          end,
          a.notes
        )
    where a.id = rdv_id;
  exception
    when exclusion_violation then
      raise exception 'Ce creneau est deja occupe.' using errcode = 'unique_violation';
  end;

  insert into public.activities (organization_id, actor_user_id, type, subject_type, subject_id, summary)
  values (org_id, (select auth.uid()), 'APPOINTMENT_STATUS_CHANGED', 'appointment', rdv_id,
          titre || ' : ' || statut::text);
end;
$$;

grant execute on function public.set_appointment_status(uuid, public.appointment_status, text) to authenticated;
