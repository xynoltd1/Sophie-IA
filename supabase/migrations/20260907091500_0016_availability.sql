-- =============================================================================
-- 0016 — Moteur de disponibilites et connexion agenda externe
-- Phase 3 — section 19
--
-- Sophie ne doit JAMAIS inventer une disponibilite. Les creneaux proposes sont
-- calcules ici, a partir des donnees reelles : horaires de l entreprise,
-- rendez-vous existants, holds en cours, absences, marge entre interventions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- calendar_connections
--
-- La table existe des maintenant, meme si Google Calendar n est pas encore
-- branche : le moteur de disponibilites doit savoir si un agenda externe est
-- connecte, et savoir dire « je ne peux pas verifier » plutot que d affirmer
-- qu un creneau est libre (section 43, mode degrade).
-- -----------------------------------------------------------------------------
create table public.calendar_connections (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  member_id        uuid references public.organization_members (id) on delete cascade,

  provider         text not null default 'GOOGLE' check (provider in ('GOOGLE')),
  external_account text,
  calendar_id      text,

  -- Les jetons ne sont jamais lus par le navigateur : aucune policy SELECT ne
  -- les expose, seul le service serveur y accede.
  access_token     text,
  refresh_token    text,
  token_expires_at timestamptz,

  -- Les abonnements aux notifications de changement expirent chez le
  -- fournisseur. Sans renouvellement planifie, la synchronisation s arrete
  -- silencieusement au bout de quelques jours.
  channel_id       text,
  channel_expires_at timestamptz,

  is_active        boolean not null default true,
  last_synced_at   timestamptz,
  last_error       text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Une contrainte UNIQUE de table n accepte pas d expression : on passe par un
-- index. L intervenant non designe compte comme un intervenant a part entiere.
create unique index calendar_connections_unique_idx
  on public.calendar_connections (
    organization_id,
    coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid),
    provider
  );

create trigger calendar_connections_set_updated_at
  before update on public.calendar_connections
  for each row execute function public.set_updated_at();

alter table public.calendar_connections enable row level security;

-- Lecture limitee au statut : le professionnel doit savoir si son agenda est
-- connecte, sans que les jetons transitent par le navigateur.
create view public.calendar_status
with (security_invoker = true)
as
  select organization_id, member_id, provider, external_account,
         is_active, last_synced_at, last_error, channel_expires_at
  from public.calendar_connections;

grant select on public.calendar_status to authenticated;

create policy "agenda: lecture du statut par les membres"
  on public.calendar_connections for select to authenticated
  using (public.is_org_member(organization_id));

-- Aucun privilege d ecriture pour authenticated : la connexion OAuth se fait
-- cote serveur, avec la cle service_role, apres validation de l etat OAuth.
grant select on public.calendar_connections to authenticated;

-- -----------------------------------------------------------------------------
-- Creneaux disponibles
--
-- Renvoie les debuts de creneaux possibles pour un jour donne. La granularite
-- est le pas de 15 minutes, borne par les horaires de l entreprise, et filtree
-- par ce qui occupe deja l agenda.
-- -----------------------------------------------------------------------------
create or replace function public.available_slots(
  org_id      uuid,
  jour        date,
  duree_min   int default null,
  intervenant uuid default null
)
returns table (creneau timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  fuseau     text;
  duree      int;
  marge      int;
  ouverture  time;
  fermeture  time;
  ouvert     boolean;
  jour_iso   int;
  debut_jour timestamptz;
  fin_jour   timestamptz;
begin
  if not public.is_org_member(org_id) then
    raise exception 'Droits insuffisants.' using errcode = '42501';
  end if;

  select o.timezone into fuseau from public.organizations o where o.id = org_id;
  fuseau := coalesce(fuseau, 'Europe/Brussels');

  select coalesce(duree_min, bp.default_appointment_minutes), bp.buffer_minutes
  into duree, marge
  from public.business_profiles bp
  where bp.organization_id = org_id;

  duree := coalesce(duree, 60);
  marge := coalesce(marge, 15);

  jour_iso := extract(isodow from jour);

  select bh.is_open, bh.opens_at, bh.closes_at
  into ouvert, ouverture, fermeture
  from public.business_hours bh
  where bh.organization_id = org_id
    and bh.weekday = jour_iso
    and bh.member_id is null;

  -- Jour ferme, ou horaires jamais configures : aucun creneau. Sophie dira
  -- qu elle transmet la demande plutot que d inventer une disponibilite.
  if not coalesce(ouvert, false) or ouverture is null or fermeture is null then
    return;
  end if;

  debut_jour := (jour + ouverture) at time zone fuseau;
  fin_jour   := (jour + fermeture) at time zone fuseau;

  return query
  with pas as (
    select generate_series(debut_jour, fin_jour - make_interval(mins => duree), interval '15 minutes') as depart
  )
  select p.depart
  from pas p
  where
    -- Jamais dans le passe.
    p.depart > now()
    -- Aucun rendez-vous actif ne chevauche le creneau, marge comprise.
    and not exists (
      select 1 from public.appointments a
      where a.organization_id = org_id
        and a.status in ('HELD', 'PENDING_APPROVAL', 'CONFIRMED', 'CHANGE_PROPOSED')
        and (intervenant is null or a.assigned_member_id is not distinct from intervenant)
        and a.slot && tstzrange(
              p.depart - make_interval(mins => marge),
              p.depart + make_interval(mins => duree + marge),
              '[)'
            )
    )
    -- Aucune absence ne recouvre le creneau.
    and not exists (
      select 1 from public.absences ab
      where ab.organization_id = org_id
        and (intervenant is null or ab.member_id is null or ab.member_id = intervenant)
        and tstzrange(ab.starts_at, ab.ends_at, '[)')
            && tstzrange(p.depart, p.depart + make_interval(mins => duree), '[)')
    )
  order by p.depart;
end;
$$;

grant execute on function public.available_slots(uuid, date, int, uuid) to authenticated;

comment on function public.available_slots(uuid, date, int, uuid) is
  'Creneaux reellement libres. Ne tient pas encore compte d un agenda Google : tant que calendar_connections est vide, l entreprise doit savoir que seules ses heures d ouverture sont prises en compte.';

-- -----------------------------------------------------------------------------
-- Rendez-vous du jour, pour l accueil (section 30)
-- -----------------------------------------------------------------------------
create or replace function public.appointments_for_day(org_id uuid, jour date)
returns table (
  id           uuid,
  title        text,
  starts_at    timestamptz,
  ends_at      timestamptz,
  status       public.appointment_status,
  contact_name text,
  city         text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  fuseau text;
begin
  if not public.is_org_member(org_id) then
    raise exception 'Droits insuffisants.' using errcode = '42501';
  end if;

  select o.timezone into fuseau from public.organizations o where o.id = org_id;
  fuseau := coalesce(fuseau, 'Europe/Brussels');

  return query
  select a.id, a.title, a.starts_at, a.ends_at, a.status,
         coalesce(c.full_name, c.company_name, c.phone),
         coalesce(a.city, c.city)
  from public.appointments a
  left join public.contacts c on c.id = a.contact_id
  where a.organization_id = org_id
    and a.status in ('PENDING_APPROVAL', 'CONFIRMED', 'CHANGE_PROPOSED')
    and (a.starts_at at time zone fuseau)::date = jour
  order by a.starts_at;
end;
$$;

grant execute on function public.appointments_for_day(uuid, date) to authenticated;
