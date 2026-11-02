-- =============================================================================
-- 0030 — Conservation des donnees, et gestion de la ligne telephonique
--
-- Deux sujets que l audit du 2 novembre a classes « haute priorite ».
--
-- **Rien ne se purgeait, sauf l audio.** Transcriptions, resumes, donnees
-- extraites et SMS s accumulaient sans limite. Ils contiennent le nom,
-- l adresse et le probleme de vrais clients. Une donnee personnelle conservee
-- sans duree n est pas une donnee bien gardee : c est une donnee oubliee.
--
-- **Aucun ecran ne permettait de declarer un numero.** La table existait
-- depuis la migration 0019, remplie a la main en SQL. Tant qu elle est vide,
-- tout appel tombe dans le repli « essai » et rien ne peut etre verifie.
--
-- Les durees retenues ici sont des valeurs de depart. Elles devront etre
-- confirmees par un juriste avant toute mise en production (LEGAL_COMPLIANCE).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Durees de conservation, par entreprise
--
-- L audio garde sa colonne et son plafond de 30 jours (ADR-013). Les trois
-- nouvelles durees sont plus longues : une transcription sert a retrouver ce
-- qui a ete dit six mois plus tard, un enregistrement sert a lever un doute
-- dans la semaine.
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column if not exists transcript_retention_days int not null default 365,
  add column if not exists summary_retention_days    int not null default 365,
  add column if not exists message_retention_days    int not null default 365;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_retention_bounds') then
    alter table public.organizations
      add constraint organizations_retention_bounds check (
        transcript_retention_days between 30 and 1825
        and summary_retention_days between 30 and 1825
        and message_retention_days between 30 and 1825
      );
  end if;
end
$$;

comment on column public.organizations.transcript_retention_days is
  'Conservation de la transcription, en jours. Plancher 30 : en dessous, le professionnel perdrait la trace avant d avoir pu l utiliser. Plafond 5 ans. A confirmer juridiquement.';

-- -----------------------------------------------------------------------------
-- 2. Journal des purges
--
-- Une purge qui ne laisse pas de trace est une purge qu on ne peut ni prouver
-- ni diagnostiquer. Deux usages : montrer a un client que ses donnees ont bien
-- ete effacees, et voir qu une purge echoue depuis trois semaines.
-- -----------------------------------------------------------------------------
create table if not exists public.retention_runs (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in (
    'AUDIO', 'TRANSCRIPT', 'SUMMARY', 'CALL_EVENT', 'MESSAGE', 'CALL_TRASH'
  )),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  affected     int not null default 0,
  outcome      text not null default 'SUCCESS' check (outcome in ('SUCCESS', 'PARTIAL', 'ERROR')),
  detail       text,
  created_at   timestamptz not null default now()
);

create index if not exists retention_runs_recent_idx
  on public.retention_runs (kind, started_at desc);

alter table public.retention_runs enable row level security;

drop policy if exists "purges: lecture plateforme" on public.retention_runs;
create policy "purges: lecture plateforme"
  on public.retention_runs for select to authenticated
  using (public.is_platform_admin());

grant select on public.retention_runs to authenticated;

comment on table public.retention_runs is
  'Journal des purges. Sert a prouver un effacement et a voir qu une purge echoue silencieusement.';

-- -----------------------------------------------------------------------------
-- 3. Les purges elles-memes
--
-- Chacune est independante et bornee : au pire, une purge bloquee retarde les
-- autres d une journee au lieu de les empecher toutes.
--
-- Toutes respectent la duree PROPRE A CHAQUE ENTREPRISE : une organisation qui
-- a choisi 90 jours ne doit pas subir le defaut d une autre.
-- -----------------------------------------------------------------------------

/**
 * Transcriptions arrivees a echeance.
 *
 * L appel, lui, survit : sa date, sa duree et son issue restent. Ce qui part,
 * c est le contenu de la conversation.
 */
create or replace function public.purge_expired_transcripts(limite int default 500)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  supprimes int;
begin
  with a_purger as (
    select s.id
    from public.call_transcript_segments s
    join public.calls c on c.id = s.call_id
    join public.organizations o on o.id = c.organization_id
    where c.started_at < now() - make_interval(days => o.transcript_retention_days)
    limit greatest(1, least(limite, 5000))
  )
  delete from public.call_transcript_segments s
  using a_purger p
  where s.id = p.id;

  get diagnostics supprimes = row_count;

  if supprimes > 0 then
    update public.calls c
    set transcription_status = 'NOT_APPLICABLE'
    where c.transcription_status = 'DONE'
      and not exists (select 1 from public.call_transcript_segments s where s.call_id = c.id);
  end if;

  return supprimes;
end;
$$;

revoke all on function public.purge_expired_transcripts(int) from public, anon, authenticated;

/**
 * Resumes et donnees extraites arrives a echeance.
 *
 * On vide les colonnes au lieu de supprimer la ligne : l appel doit continuer
 * d exister, avec sa date et sa duree, pour les statistiques et la facturation.
 */
create or replace function public.purge_expired_summaries(limite int default 500)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  vides int;
begin
  with a_purger as (
    select c.id
    from public.calls c
    join public.organizations o on o.id = c.organization_id
    where (c.summary is not null or c.structured_data is not null)
      and c.started_at < now() - make_interval(days => o.summary_retention_days)
    limit greatest(1, least(limite, 5000))
  )
  update public.calls c
  set summary = null,
      structured_data = null,
      summary_status = 'NOT_APPLICABLE',
      summary_error = null
  from a_purger p
  where c.id = p.id;

  get diagnostics vides = row_count;
  return vides;
end;
$$;

revoke all on function public.purge_expired_summaries(int) from public, anon, authenticated;

/**
 * Messages arrives a echeance.
 *
 * Les deux tables partent ensemble : `outbound_messages` porte le texte envoye,
 * `conversation_messages` le meme texte dans le fil. Garder l un sans l autre
 * laisserait la donnee personnelle dans la base tout en pretendant l avoir
 * effacee.
 */
create or replace function public.purge_expired_messages(limite int default 500)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  supprimes int;
  total int := 0;
begin
  with a_purger as (
    select m.id
    from public.conversation_messages m
    join public.organizations o on o.id = m.organization_id
    where m.occurred_at < now() - make_interval(days => o.message_retention_days)
    limit greatest(1, least(limite, 5000))
  )
  delete from public.conversation_messages m
  using a_purger p
  where m.id = p.id;

  get diagnostics supprimes = row_count;
  total := total + supprimes;

  with a_purger as (
    select m.id
    from public.outbound_messages m
    join public.organizations o on o.id = m.organization_id
    where m.created_at < now() - make_interval(days => o.message_retention_days)
    limit greatest(1, least(limite, 5000))
  )
  delete from public.outbound_messages m
  using a_purger p
  where m.id = p.id;

  get diagnostics supprimes = row_count;
  total := total + supprimes;

  return total;
end;
$$;

revoke all on function public.purge_expired_messages(int) from public, anon, authenticated;

/** Consigne le resultat d une purge. Appelee par le serveur apres chaque passe. */
create or replace function public.record_retention_run(
  genre text,
  nombre int,
  issue text default 'SUCCESS',
  message text default null
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.retention_runs (kind, finished_at, affected, outcome, detail)
  values (genre, now(), greatest(0, nombre), issue, left(message, 500));
$$;

revoke all on function public.record_retention_run(text, int, text, text)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. La ligne telephonique, administrable depuis l application
--
-- `phone_numbers` n avait aucune policy d ecriture : la table se remplissait
-- en SQL. Trois ajouts : le mode de connexion, la trace de la derniere erreur,
-- et le droit d ecrire pour un responsable.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'line_connection_mode') then
    create type public.line_connection_mode as enum (
      'FORWARD',   -- l artisan garde son numero et le renvoie vers le notre (ADR-022)
      'DIRECT',    -- il communique directement le numero que nous fournissons
      'PORTED'     -- son numero a ete porte chez notre operateur
    );
  end if;
end
$$;

alter table public.phone_numbers
  add column if not exists connection_mode public.line_connection_mode not null default 'FORWARD',
  -- Le numero que l artisan donne a ses clients, quand il differe du notre.
  add column if not exists public_number text,
  add column if not exists last_error text,
  add column if not exists verified_at timestamptz;

comment on column public.phone_numbers.public_number is
  'Numero communique aux clients. En mode FORWARD, c est celui de l artisan ; les appels arrivent sur e164.';

drop policy if exists "numeros: creation par les responsables" on public.phone_numbers;
create policy "numeros: creation par les responsables"
  on public.phone_numbers for insert to authenticated
  with check (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]));

drop policy if exists "numeros: suppression par les responsables" on public.phone_numbers;
create policy "numeros: suppression par les responsables"
  on public.phone_numbers for delete to authenticated
  using (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]));

grant insert, delete on public.phone_numbers to authenticated;
