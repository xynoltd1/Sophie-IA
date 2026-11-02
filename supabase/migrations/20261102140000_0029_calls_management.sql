-- =============================================================================
-- 0029 — Liste des appels : relation manquante, corbeille, recherche paginee
--
-- Trois sujets, et le premier est un bug visible a l ecran.
--
-- **La liste de l equipe ne se chargeait pas.** `organization_members.user_id`
-- reference `auth.users`, et `profiles.id` aussi — mais il n existe aucune
-- cle etrangere ENTRE les deux tables. PostgREST ne peut donc pas deduire la
-- relation, et `select(..., profiles(full_name))` echoue avec « could not find
-- a relationship ». L ecran affichait « la liste de l equipe n a pas pu etre
-- chargee », ce qui etait vrai mais inexploitable.
--
-- **La suppression d un appel** demande une corbeille, pas un `delete`. Un
-- appel porte une transcription, un enregistrement, et sert de preuve a un
-- rendez-vous. Le supprimer par erreur doit pouvoir s annuler.
--
-- **La liste doit se paginer en base.** Charger tous les appels puis filtrer
-- dans le navigateur ne tient pas au-dela de quelques dizaines d appels, et
-- le filtre « sans suite » ne peut pas se calculer sur une page partielle.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. La relation manquante entre membres et profils
-- -----------------------------------------------------------------------------

-- D abord, reparer les donnees : un membre sans profil empecherait la cle
-- etrangere d exister. Le declencheur `handle_new_user` cree le profil a
-- l inscription, mais une ligne inseree autrement a pu y echapper.
insert into public.profiles (id)
select distinct m.user_id
from public.organization_members m
left join public.profiles p on p.id = m.user_id
where p.id is null
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organization_members_profile_fkey'
  ) then
    alter table public.organization_members
      add constraint organization_members_profile_fkey
      foreign key (user_id) references public.profiles (id) on delete cascade;
  end if;
end
$$;

comment on constraint organization_members_profile_fkey on public.organization_members is
  'Rend la relation membre -> profil deductible par PostgREST. Sans elle, afficher le nom d un membre est impossible en une requete.';

-- -----------------------------------------------------------------------------
-- 2. Corbeille des appels
--
-- Suppression logique : la ligne reste, invisible, pendant 30 jours. Ce delai
-- permet d annuler une erreur, et il s aligne sur la retention audio.
-- -----------------------------------------------------------------------------
alter table public.calls
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id) on delete set null;

create index if not exists calls_not_deleted_idx
  on public.calls (organization_id, started_at desc) where deleted_at is null;
create index if not exists calls_trash_idx
  on public.calls (deleted_at) where deleted_at is not null;

comment on column public.calls.deleted_at is
  'Mise a la corbeille. La ligne reste 30 jours, puis le travail planifie supprime le fichier audio et la ligne.';

/**
 * Mettre des appels a la corbeille.
 *
 * Reserve a OWNER et ADMIN : un appel est une trace, et sa disparition doit
 * etre une decision de responsable, pas un geste de passage.
 *
 * Ce que cette fonction NE touche pas, volontairement : les rendez-vous, les
 * contacts, les demandes et les taches nes de l appel. Supprimer la trace d un
 * appel ne doit jamais faire disparaitre un rendez-vous confirme ni un client.
 * Le lien `call_id` se videra tout seul a la purge definitive
 * (`on delete set null`).
 */
create or replace function public.trash_calls(org_id uuid, ids uuid[])
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  touches int;
begin
  if not public.has_org_role(org_id, array['OWNER','ADMIN']::public.member_role[]) then
    raise exception 'Seul un responsable peut supprimer des appels.' using errcode = '42501';
  end if;

  update public.calls c
  set deleted_at = now(),
      deleted_by = (select auth.uid())
  where c.organization_id = org_id
    and c.id = any(ids)
    and c.deleted_at is null;

  get diagnostics touches = row_count;

  if touches > 0 then
    insert into public.audit_logs
      (organization_id, actor_user_id, action, resource_type, details)
    values (
      org_id, (select auth.uid()), 'CALLS_TRASHED', 'call',
      jsonb_build_object('count', touches, 'ids', to_jsonb(ids))
    );
  end if;

  return touches;
end;
$$;

grant execute on function public.trash_calls(uuid, uuid[]) to authenticated;

/** Sortir des appels de la corbeille, tant que la purge n est pas passee. */
create or replace function public.restore_calls(org_id uuid, ids uuid[])
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  touches int;
begin
  if not public.has_org_role(org_id, array['OWNER','ADMIN']::public.member_role[]) then
    raise exception 'Seul un responsable peut restaurer des appels.' using errcode = '42501';
  end if;

  update public.calls c
  set deleted_at = null, deleted_by = null
  where c.organization_id = org_id and c.id = any(ids) and c.deleted_at is not null;

  get diagnostics touches = row_count;

  if touches > 0 then
    insert into public.audit_logs
      (organization_id, actor_user_id, action, resource_type, details)
    values (org_id, (select auth.uid()), 'CALLS_RESTORED', 'call',
            jsonb_build_object('count', touches));
  end if;

  return touches;
end;
$$;

grant execute on function public.restore_calls(uuid, uuid[]) to authenticated;

/**
 * Les appels dont la corbeille a expire.
 *
 * Le serveur lit cette liste, supprime d abord le fichier audio, puis la
 * ligne. L ordre importe : effacer la ligne d abord laisserait un fichier que
 * plus rien ne reference, donc que plus rien ne supprimera jamais.
 */
create or replace function public.calls_to_purge(limite int default 100)
returns table (call_id uuid, organization_id uuid, recording_path text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.organization_id, c.recording_path
  from public.calls c
  where c.deleted_at is not null
    and c.deleted_at < now() - interval '30 days'
  order by c.deleted_at
  limit greatest(1, least(limite, 500));
$$;

revoke all on function public.calls_to_purge(int) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Recherche paginee des appels
--
-- Tout se decide en base : les filtres, le tri, le comptage. Trois raisons.
--
-- Le filtre « sans suite » demande de savoir si un appel a produit quelque
-- chose, ce qui ne peut pas se calculer sur une page deja decoupee.
--
-- Le total doit etre juste meme quand on n affiche que dix lignes.
--
-- Et l ordre doit etre deterministe : deux appels a la meme seconde doivent
-- toujours sortir dans le meme ordre, sinon la page 2 peut repeter ou sauter
-- une ligne. D ou le tri secondaire sur l identifiant.
-- -----------------------------------------------------------------------------
create or replace function public.search_calls(
  org_id        uuid,
  terme         text default null,
  statut        text default null,   -- TOUS, SANS_SUITE, ECHOUES, AVEC_RDV, URGENTS, ESSAIS, TERMINES
  depuis        timestamptz default null,
  jusqu_a       timestamptz default null,
  inclure_essais boolean default true,
  dans_corbeille boolean default false,
  page          int default 1,
  taille        int default 20
)
returns table (
  id                uuid,
  from_e164         text,
  status            public.call_status,
  started_at        timestamptz,
  duration_seconds  int,
  is_test           boolean,
  contact_id        uuid,
  contact_name      text,
  summary           text,
  has_recording     boolean,
  has_summary       boolean,
  is_urgent         boolean,
  has_appointment   boolean,
  without_followup  boolean,
  total_count       bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  decalage int;
  taille_reelle int;
  motif text;
begin
  if not public.is_org_member(org_id) then
    raise exception 'Droits insuffisants.' using errcode = '42501';
  end if;

  taille_reelle := greatest(1, least(coalesce(taille, 20), 50));
  decalage := greatest(0, (greatest(1, coalesce(page, 1)) - 1) * taille_reelle);
  motif := case
             when terme is null or btrim(terme) = '' then null
             else '%' || btrim(terme) || '%'
           end;

  return query
  with base as (
    select c.*,
           ct.full_name,
           ct.company_name,
           ct.phone_e164,
           exists (select 1 from public.appointments a where a.call_id = c.id) as rdv,
           exists (select 1 from public.leads l where l.call_id = c.id and l.priority = 'URGENT') as urgence,
           exists (select 1 from public.leads l where l.call_id = c.id) as lead,
           exists (select 1 from public.tasks t where t.call_id = c.id) as tache
    from public.calls c
    left join public.contacts ct on ct.id = c.contact_id
    where c.organization_id = org_id
      and (case when dans_corbeille then c.deleted_at is not null else c.deleted_at is null end)
      and (inclure_essais or c.is_test = false)
      and (depuis is null or c.started_at >= depuis)
      and (jusqu_a is null or c.started_at < jusqu_a)
      and (
        motif is null
        or c.from_e164 ilike motif
        or ct.full_name ilike motif
        or ct.company_name ilike motif
        or ct.phone_e164 ilike motif
      )
  ),
  filtre as (
    select * from base b
    where case coalesce(statut, 'TOUS')
            when 'SANS_SUITE' then
              b.status = 'COMPLETED'
              and b.is_test = false
              and (b.duration_seconds is null or b.duration_seconds >= 15)
              and b.started_at > now() - interval '7 days'
              and not b.lead and not b.rdv and not b.tache
            when 'ECHOUES'  then b.status in ('FAILED', 'MISSED')
            when 'AVEC_RDV' then b.rdv
            when 'URGENTS'  then b.urgence
            when 'ESSAIS'   then b.is_test
            when 'TERMINES' then b.status = 'COMPLETED'
            else true
          end
  ),
  compte as (select count(*) as total from filtre)
  select f.id,
         f.from_e164,
         f.status,
         f.started_at,
         f.duration_seconds,
         f.is_test,
         f.contact_id,
         coalesce(f.full_name, f.company_name),
         f.summary,
         f.recording_path is not null,
         f.summary is not null,
         f.urgence,
         f.rdv,
         (f.status = 'COMPLETED'
           and f.is_test = false
           and (f.duration_seconds is null or f.duration_seconds >= 15)
           and not f.lead and not f.rdv and not f.tache),
         compte.total
  from filtre f, compte
  -- Ordre deterministe : sans le second critere, deux appels a la meme
  -- seconde pourraient changer de place entre deux pages.
  order by f.started_at desc, f.id desc
  limit taille_reelle offset decalage;
end;
$$;

grant execute on function public.search_calls(uuid, text, text, timestamptz, timestamptz, boolean, boolean, int, int) to authenticated;

comment on function public.search_calls is
  'Liste paginee et filtree des appels. Tout est decide en base : le filtre « sans suite » ne peut pas se calculer sur une page partielle, et le total doit rester juste.';

-- -----------------------------------------------------------------------------
-- 4. Les compteurs de l accueil ignorent la corbeille
--
-- Sans cela, un appel mis a la corbeille continuerait d apparaitre comme
-- « a rappeler » sur l accueil, et le compteur ne correspondrait plus a la
-- liste. Un chiffre qui ne mene nulle part est pire que pas de chiffre.
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_counts(org_id uuid)
returns table (
  urgent_leads       int,
  new_leads          int,
  overdue_tasks      int,
  tasks_today        int,
  open_leads         int,
  contacts_total     int,
  pending_appointments int,
  calls_no_followup  int,
  calls_failed       int
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
  select
    (select count(*)::int from public.leads l
      where l.organization_id = org_id
        and l.priority = 'URGENT'
        and l.status not in ('WON', 'LOST')),
    (select count(*)::int from public.leads l
      where l.organization_id = org_id and l.status = 'NEW'),
    (select count(*)::int from public.tasks t
      where t.organization_id = org_id
        and t.status = 'OPEN'
        and t.due_at is not null
        and t.due_at < now()),
    (select count(*)::int from public.tasks t
      where t.organization_id = org_id
        and t.status = 'OPEN'
        and t.due_at is not null
        and (t.due_at at time zone fuseau)::date = (now() at time zone fuseau)::date),
    (select count(*)::int from public.leads l
      where l.organization_id = org_id and l.status not in ('WON', 'LOST')),
    (select count(*)::int from public.contacts c
      where c.organization_id = org_id),
    (select count(*)::int from public.appointments a
      where a.organization_id = org_id
        and a.status = 'PENDING_APPROVAL'),
    (select count(*)::int from public.calls c
      where c.organization_id = org_id
        and c.deleted_at is null
        and c.status = 'COMPLETED'
        and c.is_test = false
        and (c.duration_seconds is null or c.duration_seconds >= 15)
        and c.started_at > now() - interval '7 days'
        and not exists (select 1 from public.leads        x where x.call_id = c.id)
        and not exists (select 1 from public.appointments x where x.call_id = c.id)
        and not exists (select 1 from public.tasks        x where x.call_id = c.id)),
    (select count(*)::int from public.calls c
      where c.organization_id = org_id
        and c.deleted_at is null
        and c.status in ('FAILED', 'MISSED')
        and c.is_test = false
        and c.started_at > now() - interval '7 days');
end;
$$;

grant execute on function public.dashboard_counts(uuid) to authenticated;
