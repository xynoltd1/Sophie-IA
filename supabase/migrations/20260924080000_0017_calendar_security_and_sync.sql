-- =============================================================================
-- 0017 — Securite des jetons d agenda et synchronisation des occupations
-- Phase 3 — Google Calendar reel
--
-- FAILLE CORRIGEE ICI. La migration 0016 accordait `grant select` sur TOUTE la
-- table calendar_connections a `authenticated`, avec une policy ouverte a tous
-- les membres. Un membre connecte pouvait donc lire access_token et
-- refresh_token de son organisation. Le commentaire du fichier affirmait
-- l inverse (« Les jetons ne sont jamais lus par le navigateur ») : l intention
-- etait bonne, la mise en oeuvre ne la suivait pas.
--
-- Correction : privileges au niveau COLONNE. Les colonnes de jetons ne sont
-- accessibles qu au role service_role.
-- =============================================================================

revoke all on public.calendar_connections from authenticated;

-- Seules les colonnes non sensibles sont lisibles. Postgres refuse l acces aux
-- autres meme si la requete les demande explicitement.
grant select (
  id, organization_id, member_id, provider, external_account, calendar_id,
  is_active, last_synced_at, last_error, channel_expires_at, created_at, updated_at
) on public.calendar_connections to authenticated;

comment on column public.calendar_connections.access_token is
  'SECRET. Chiffre par l application (AES-256-GCM). Aucun privilege pour authenticated.';
comment on column public.calendar_connections.refresh_token is
  'SECRET. Chiffre par l application. Sa fuite donnerait un acces durable a l agenda du client.';

-- Jeton de synchronisation incrementale. Sans lui, chaque synchronisation
-- relirait tout l agenda.
alter table public.calendar_connections
  add column if not exists sync_token text,
  add column if not exists last_full_sync_at timestamptz,
  add column if not exists consecutive_failures int not null default 0;

-- -----------------------------------------------------------------------------
-- calendar_busy_blocks — occupations importees d un agenda externe
--
-- Pourquoi une table et non un appel a Google au moment du calcul :
-- available_slots() est une fonction SQL, elle ne peut pas appeler une API. Et
-- pendant un appel telephonique, on ne peut pas dependre d un aller-retour
-- reseau vers Google pour repondre au client.
--
-- La fraicheur est donc surveillee explicitement : calendar_sync_state() dit si
-- les donnees sont a jour. Si elles ne le sont pas, Sophie ne propose rien et
-- annonce que le professionnel confirmera (section 19 et 43).
-- -----------------------------------------------------------------------------
create table public.calendar_busy_blocks (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  connection_id     uuid not null references public.calendar_connections (id) on delete cascade,
  member_id         uuid references public.organization_members (id) on delete cascade,

  external_event_id text not null,
  summary           text,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  is_all_day        boolean not null default false,

  -- Un evenement Google auquel le professionnel a repondu « non » ne l occupe
  -- pas. On conserve l information pour pouvoir l expliquer.
  transparency      text not null default 'opaque' check (transparency in ('opaque', 'transparent')),

  synced_at         timestamptz not null default now(),
  created_at        timestamptz not null default now(),

  constraint calendar_busy_blocks_coherent check (ends_at > starts_at)
);

comment on table public.calendar_busy_blocks is
  'Plages occupees importees d un agenda externe. Le contenu des evenements n est pas stocke, seulement leur emprise horaire et un intitule facultatif.';

create unique index calendar_busy_blocks_unique_idx
  on public.calendar_busy_blocks (connection_id, external_event_id);

create index calendar_busy_blocks_window_idx
  on public.calendar_busy_blocks (organization_id, starts_at, ends_at)
  where transparency = 'opaque';

alter table public.calendar_busy_blocks enable row level security;

-- Lecture seule pour les membres : ces lignes viennent de Google, pas du
-- navigateur. L ecriture est reservee au service de synchronisation.
grant select on public.calendar_busy_blocks to authenticated;

create policy "occupations agenda: lecture par les membres"
  on public.calendar_busy_blocks for select to authenticated
  using (public.is_org_member(organization_id));

-- -----------------------------------------------------------------------------
-- Etat de synchronisation
--
-- Repond a une seule question : « puis-je faire confiance aux creneaux que je
-- m apprete a proposer ? » Trois reponses possibles, et « je ne sais pas » en
-- est une.
-- -----------------------------------------------------------------------------
create or replace function public.calendar_sync_state(org_id uuid)
returns table (
  connected      boolean,
  is_fresh       boolean,
  last_synced_at timestamptz,
  last_error     text,
  staleness      interval
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  seuil constant interval := interval '30 minutes';
begin
  if not public.is_org_member(org_id) then
    raise exception 'Droits insuffisants.' using errcode = '42501';
  end if;

  return query
  select
    exists (
      select 1 from public.calendar_connections c
      where c.organization_id = org_id and c.is_active
    ),
    coalesce(
      (select bool_and(c.last_synced_at is not null and c.last_synced_at > now() - seuil)
       from public.calendar_connections c
       where c.organization_id = org_id and c.is_active),
      -- Aucun agenda connecte : on ne peut pas etre « perime », mais on ne peut
      -- pas non plus pretendre voir l agenda du professionnel.
      false
    ),
    (select max(c.last_synced_at) from public.calendar_connections c
      where c.organization_id = org_id and c.is_active),
    (select c.last_error from public.calendar_connections c
      where c.organization_id = org_id and c.is_active and c.last_error is not null
      order by c.updated_at desc limit 1),
    (select now() - max(c.last_synced_at) from public.calendar_connections c
      where c.organization_id = org_id and c.is_active);
end;
$$;

grant execute on function public.calendar_sync_state(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- available_slots — version tenant compte de l agenda externe
--
-- Seul ajout par rapport a 0016 : l exclusion des calendar_busy_blocks. Le
-- reste du calcul est inchange.
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
    p.depart > now()
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
    and not exists (
      select 1 from public.absences ab
      where ab.organization_id = org_id
        and (intervenant is null or ab.member_id is null or ab.member_id = intervenant)
        and tstzrange(ab.starts_at, ab.ends_at, '[)')
            && tstzrange(p.depart, p.depart + make_interval(mins => duree), '[)')
    )
    -- Agenda externe : le professionnel a peut-etre note un chantier dans son
    -- propre Google Calendar. Sophie ne doit pas proposer ce creneau.
    and not exists (
      select 1 from public.calendar_busy_blocks b
      where b.organization_id = org_id
        and b.transparency = 'opaque'
        and (intervenant is null or b.member_id is null or b.member_id = intervenant)
        and tstzrange(b.starts_at, b.ends_at, '[)')
            && tstzrange(
                 p.depart - make_interval(mins => marge),
                 p.depart + make_interval(mins => duree + marge),
                 '[)'
               )
    )
  order by p.depart;
end;
$$;

grant execute on function public.available_slots(uuid, date, int, uuid) to authenticated;

comment on function public.available_slots(uuid, date, int, uuid) is
  'Creneaux reellement libres : horaires, rendez-vous, holds, absences, marge, et occupations importees de l agenda externe. Verifier calendar_sync_state() avant de proposer ces creneaux a un client.';

-- -----------------------------------------------------------------------------
-- Suivi de la synchronisation d un rendez-vous vers l agenda externe
--
-- Section 22 : « Si Calendar echoue, ne pas afficher faussement que tout est
-- confirme. » Un rendez-vous peut donc etre confirme chez nous et absent de
-- l agenda Google. Cet ecart doit etre visible, pas masque.
-- -----------------------------------------------------------------------------
alter table public.appointments
  add column if not exists external_sync_error text,
  add column if not exists external_synced_at timestamptz;

comment on column public.appointments.external_sync_error is
  'Renseigne quand l ecriture vers l agenda externe a echoue. L interface doit le montrer et proposer de reessayer.';
