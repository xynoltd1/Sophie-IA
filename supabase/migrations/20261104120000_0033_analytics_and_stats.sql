-- =============================================================================
-- 0033 — Mesure : fréquentation du site public, statistiques de la plateforme,
--        et historique des tests d'intégration
--
-- Trois sujets, une migration, parce qu'ils répondent à la même question :
-- « qu est-ce qui se passe vraiment ? » — et qu aucun des trois n avait de
-- source de verite en base.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Historique des tests d integration
--
-- Le registre `src/lib/providers/status.ts` declare un etat ecrit a la main.
-- L ecran de sante affichait donc « Teste en conditions reelles » a cote de
-- « Variables manquantes » : deux affirmations contradictoires, l une figee
-- dans le code, l autre lue dans l environnement au moment de l affichage.
--
-- Un test reussi le 23 octobre ne prouve rien sur aujourd hui. Ce qu il faut
-- distinguer : ce que le code sait faire, ce que la configuration permet
-- aujourd hui, et quand un echange reel a reussi pour la derniere fois.
-- Cette table porte le troisieme.
-- -----------------------------------------------------------------------------
create table if not exists public.integration_checks (
  id          uuid primary key default gen_random_uuid(),
  integration text not null,
  checked_at  timestamptz not null default now(),
  outcome     text not null check (outcome in ('OK', 'FAIL')),
  detail      text,
  -- Qui a declenche : un humain depuis l ecran, ou le systeme pendant un
  -- echange reel. Un test declenche a la main ne vaut pas une transaction
  -- reelle, et l ecran doit pouvoir le dire.
  source      text not null default 'SYSTEM' check (source in ('SYSTEM', 'MANUAL')),
  created_at  timestamptz not null default now()
);

create index if not exists integration_checks_recent_idx
  on public.integration_checks (integration, checked_at desc);

alter table public.integration_checks enable row level security;

drop policy if exists "controles: lecture plateforme" on public.integration_checks;
create policy "controles: lecture plateforme"
  on public.integration_checks for select to authenticated
  using (public.is_platform_admin());

grant select on public.integration_checks to authenticated;

comment on table public.integration_checks is
  'Dernier echange reussi avec chaque service externe. Un etat declare dans le code n est pas une preuve ; ceci en est une, datee.';

-- -----------------------------------------------------------------------------
-- 2. Frequentation du site public
--
-- CE QUI N EST PAS STOCKE, ET POURQUOI
--
-- Pas d adresse IP, pas d agent utilisateur brut, pas d identifiant qui suive
-- une personne d un jour a l autre. `session_hash` est calcule cote serveur a
-- partir d elements volatils et d une graine qui change chaque jour : deux
-- visites du meme navigateur a deux jours d intervalle ne se recoupent pas.
--
-- Ce choix coute la mesure du visiteur unique sur plusieurs jours. Il evite en
-- echange un traceur, donc une banniere de consentement, donc une obligation
-- de plus avant de vendre. Pour un produit qui n a pas encore de client, le
-- compromis est evident.
--
-- CLASSIFICATION
--
-- Trois valeurs, jamais deux. `HUMAN` et `BOT` seraient un mensonge : la
-- detection de robots n est jamais sure. `UNKNOWN` porte l incertitude au lieu
-- de la cacher dans l un des deux autres.
-- -----------------------------------------------------------------------------
create table if not exists public.site_events (
  id             bigserial primary key,
  occurred_at    timestamptz not null default now(),
  event_name     text not null check (event_name in (
    'PAGE_VIEW', 'CTA_CLICK', 'SIGNUP_STARTED', 'SIGNUP_DONE'
  )),
  path           text not null,
  -- Seulement le domaine du referent, jamais l adresse complete : une adresse
  -- de provenance peut contenir une requete de recherche, donc des donnees
  -- personnelles.
  referrer_host  text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  session_hash   text not null,
  -- Cle de deduplication, calculee par le serveur : session + evenement +
  -- chemin + minute. Une colonne plutot qu un index sur expression, parce que
  -- `date_trunc` sur un horodatage avec fuseau n est pas immuable et ne peut
  -- donc pas entrer dans un index.
  dedupe_key     text not null,
  classification text not null check (classification in ('HUMAN', 'BOT', 'UNKNOWN')),
  -- Pourquoi la ligne a ete classee ainsi. Sans cela, on ne peut ni verifier
  -- la methode ni la corriger.
  reason         text,
  environment    text not null default 'production',
  created_at     timestamptz not null default now()
);

create index if not exists site_events_time_idx
  on public.site_events (occurred_at desc);
create index if not exists site_events_classification_idx
  on public.site_events (classification, occurred_at desc);
create index if not exists site_events_session_idx
  on public.site_events (session_hash, occurred_at desc);

-- Deduplication : un meme evenement rejoue (double clic, rechargement rapide,
-- script qui reessaie) ne doit pas compter deux fois.
create unique index if not exists site_events_dedupe_idx
  on public.site_events (dedupe_key);

alter table public.site_events enable row level security;

drop policy if exists "frequentation: lecture plateforme" on public.site_events;
create policy "frequentation: lecture plateforme"
  on public.site_events for select to authenticated
  using (public.is_platform_admin());

grant select on public.site_events to authenticated;

comment on table public.site_events is
  'Frequentation du site public. Sans IP ni agent utilisateur. session_hash tourne chaque jour : aucun suivi d une visite a l autre.';

-- -----------------------------------------------------------------------------
-- 3. Statistiques de la plateforme
--
-- Toutes reservees au super administrateur, toutes calculees en base. Les
-- compter cote application obligerait a rapatrier des milliers de lignes pour
-- en faire une somme.
-- -----------------------------------------------------------------------------

/**
 * Compteurs sur une periode.
 *
 * Les couts ne figurent pas ici, et c est deliberé : le produit ne connait ni
 * le tarif a la minute du fournisseur de voix, ni celui du modele, ni celui de
 * l operateur. Les inventer donnerait une marge brute fausse, et une marge
 * fausse est pire qu une marge absente.
 */
create or replace function public.platform_stats(
  depuis timestamptz default now() - interval '30 days',
  jusqua timestamptz default now()
)
returns table (
  organizations_total      int,
  organizations_new        int,
  organizations_activated  int,
  subscriptions_active     int,
  calls_total              int,
  calls_completed          int,
  calls_failed             int,
  calls_duration_seconds   bigint,
  appointments_created     int,
  appointments_confirmed   int,
  leads_created            int,
  tasks_created            int,
  urgent_leads             int,
  messages_sent            int,
  messages_failed          int,
  provider_errors          int
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
      where deleted_at is null and created_at between depuis and jusqua),
    (select count(*)::int from public.organizations
      where deleted_at is null and onboarding_completed_at between depuis and jusqua),
    (select count(*)::int from public.subscriptions where status = 'ACTIVE'),
    -- Les appels d essai sont exclus partout : ils gonfleraient chaque chiffre
    -- sans qu aucun client n ait appele.
    (select count(*)::int from public.calls
      where is_test = false and deleted_at is null and started_at between depuis and jusqua),
    (select count(*)::int from public.calls
      where is_test = false and deleted_at is null and status = 'COMPLETED'
        and started_at between depuis and jusqua),
    (select count(*)::int from public.calls
      where is_test = false and deleted_at is null and status in ('FAILED', 'MISSED')
        and started_at between depuis and jusqua),
    (select coalesce(sum(duration_seconds), 0)::bigint from public.calls
      where is_test = false and deleted_at is null and started_at between depuis and jusqua),
    (select count(*)::int from public.appointments where created_at between depuis and jusqua),
    (select count(*)::int from public.appointments
      where status = 'CONFIRMED' and created_at between depuis and jusqua),
    (select count(*)::int from public.leads where created_at between depuis and jusqua),
    (select count(*)::int from public.tasks where created_at between depuis and jusqua),
    (select count(*)::int from public.leads
      where priority = 'URGENT' and created_at between depuis and jusqua),
    (select count(*)::int from public.outbound_messages
      where status in ('SENT', 'DELIVERED') and created_at between depuis and jusqua),
    (select count(*)::int from public.outbound_messages
      where status = 'FAILED' and created_at between depuis and jusqua),
    (select count(*)::int from public.provider_errors
      where occurred_at between depuis and jusqua);
end;
$$;

revoke all on function public.platform_stats(timestamptz, timestamptz) from public, anon;
grant execute on function public.platform_stats(timestamptz, timestamptz) to authenticated;

/**
 * Series quotidiennes, pour les courbes.
 *
 * `generate_series` produit la ligne de chaque jour, y compris ceux ou rien ne
 * s est passe. Sans cela, une courbe sautant les jours vides donne une pente
 * fausse : trois appels le lundi et trois le vendredi se liraient comme deux
 * jours consecutifs.
 */
create or replace function public.platform_series(jours int default 30)
returns table (
  jour              date,
  calls             int,
  calls_failed      int,
  leads             int,
  appointments      int,
  organizations_new int,
  minutes           numeric
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
  with jours_series as (
    select generate_series(
      (current_date - (least(greatest(jours, 1), 365) - 1))::date,
      current_date,
      interval '1 day'
    )::date as jour
  )
  select
    j.jour,
    (select count(*)::int from public.calls c
      where c.is_test = false and c.deleted_at is null and c.started_at::date = j.jour),
    (select count(*)::int from public.calls c
      where c.is_test = false and c.deleted_at is null
        and c.status in ('FAILED', 'MISSED') and c.started_at::date = j.jour),
    (select count(*)::int from public.leads l where l.created_at::date = j.jour),
    (select count(*)::int from public.appointments a where a.created_at::date = j.jour),
    (select count(*)::int from public.organizations o
      where o.deleted_at is null and o.created_at::date = j.jour),
    (select coalesce(round(sum(c.duration_seconds) / 60.0, 1), 0)::numeric from public.calls c
      where c.is_test = false and c.deleted_at is null and c.started_at::date = j.jour)
  from jours_series j
  order by j.jour;
end;
$$;

revoke all on function public.platform_series(int) from public, anon;
grant execute on function public.platform_series(int) to authenticated;

/** Consommation agregee de toutes les entreprises, par nature. */
create or replace function public.usage_totals(
  depuis timestamptz default date_trunc('month', now())
)
returns table (kind public.usage_kind, total numeric, organisations int)
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
  select u.kind, sum(u.quantity)::numeric, count(distinct u.organization_id)::int
  from public.usage_records u
  where u.occurred_at >= depuis
  group by u.kind
  order by u.kind;
end;
$$;

revoke all on function public.usage_totals(timestamptz) from public, anon;
grant execute on function public.usage_totals(timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Lecture de la frequentation
-- -----------------------------------------------------------------------------

/** Totaux de frequentation, en separant ce qui est humain de ce qui ne l est pas. */
create or replace function public.site_traffic(
  depuis timestamptz default now() - interval '30 days',
  jusqua timestamptz default now()
)
returns table (
  sessions_humaines int,
  pages_humaines    int,
  sessions_incertaines int,
  evenements_robots int,
  inscriptions      int,
  clics_action      int
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
    (select count(distinct session_hash)::int from public.site_events
      where classification = 'HUMAN' and environment = 'production'
        and occurred_at between depuis and jusqua),
    (select count(*)::int from public.site_events
      where classification = 'HUMAN' and environment = 'production'
        and event_name = 'PAGE_VIEW' and occurred_at between depuis and jusqua),
    (select count(distinct session_hash)::int from public.site_events
      where classification = 'UNKNOWN' and environment = 'production'
        and occurred_at between depuis and jusqua),
    (select count(*)::int from public.site_events
      where classification = 'BOT' and environment = 'production'
        and occurred_at between depuis and jusqua),
    (select count(*)::int from public.site_events
      where classification = 'HUMAN' and environment = 'production'
        and event_name = 'SIGNUP_DONE' and occurred_at between depuis and jusqua),
    (select count(*)::int from public.site_events
      where classification = 'HUMAN' and environment = 'production'
        and event_name = 'CTA_CLICK' and occurred_at between depuis and jusqua);
end;
$$;

revoke all on function public.site_traffic(timestamptz, timestamptz) from public, anon;
grant execute on function public.site_traffic(timestamptz, timestamptz) to authenticated;

/** D ou viennent les visites humaines. */
create or replace function public.site_sources(
  depuis timestamptz default now() - interval '30 days',
  limite int default 10
)
returns table (source text, sessions int)
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
    coalesce(nullif(e.utm_source, ''), nullif(e.referrer_host, ''), 'direct') as source,
    count(distinct e.session_hash)::int
  from public.site_events e
  where e.classification = 'HUMAN' and e.environment = 'production'
    and e.occurred_at >= depuis
  group by 1
  order by 2 desc
  limit least(greatest(limite, 1), 50);
end;
$$;

revoke all on function public.site_sources(timestamptz, int) from public, anon;
grant execute on function public.site_sources(timestamptz, int) to authenticated;

/** Les pages publiques les plus vues. */
create or replace function public.site_pages(
  depuis timestamptz default now() - interval '30 days',
  limite int default 10
)
returns table (chemin text, vues int)
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
  select e.path, count(*)::int
  from public.site_events e
  where e.classification = 'HUMAN' and e.environment = 'production'
    and e.event_name = 'PAGE_VIEW' and e.occurred_at >= depuis
  group by e.path
  order by 2 desc
  limit least(greatest(limite, 1), 50);
end;
$$;

revoke all on function public.site_pages(timestamptz, int) from public, anon;
grant execute on function public.site_pages(timestamptz, int) to authenticated;

/** Courbe quotidienne de la frequentation humaine. */
create or replace function public.site_series(jours int default 30)
returns table (jour date, sessions int, pages int)
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
  with jours_series as (
    select generate_series(
      (current_date - (least(greatest(jours, 1), 365) - 1))::date,
      current_date,
      interval '1 day'
    )::date as jour
  )
  select
    j.jour,
    (select count(distinct e.session_hash)::int from public.site_events e
      where e.classification = 'HUMAN' and e.environment = 'production'
        and e.occurred_at::date = j.jour),
    (select count(*)::int from public.site_events e
      where e.classification = 'HUMAN' and e.environment = 'production'
        and e.event_name = 'PAGE_VIEW' and e.occurred_at::date = j.jour)
  from jours_series j
  order by j.jour;
end;
$$;

revoke all on function public.site_series(int) from public, anon;
grant execute on function public.site_series(int) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Ecriture : reservee au serveur
-- -----------------------------------------------------------------------------

/**
 * Consigne un controle d integration.
 *
 * Appelee par le code serveur apres un echange reel reussi ou rate. Jamais par
 * le navigateur : un client pourrait declarer que tout va bien.
 */
create or replace function public.record_integration_check(
  cle     text,
  issue   text,
  message text default null,
  origine text default 'SYSTEM'
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.integration_checks (integration, outcome, detail, source)
  values (cle, issue, left(coalesce(message, ''), 500), origine);
end;
$$;

revoke all on function public.record_integration_check(text, text, text, text)
  from public, anon, authenticated;

/** Dernier controle connu de chaque integration. */
create or replace function public.integration_health()
returns table (
  integration text,
  last_ok     timestamptz,
  last_fail   timestamptz,
  last_detail text
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
    c.integration,
    max(c.checked_at) filter (where c.outcome = 'OK'),
    max(c.checked_at) filter (where c.outcome = 'FAIL'),
    (array_agg(c.detail order by c.checked_at desc) filter (where c.outcome = 'FAIL'))[1]
  from public.integration_checks c
  group by c.integration;
end;
$$;

revoke all on function public.integration_health() from public, anon;
grant execute on function public.integration_health() to authenticated;

-- Les nouvelles tables heritent des privileges par defaut : on applique la
-- meme regle que la migration 0031.
revoke truncate, references, trigger on public.integration_checks from anon, authenticated;
revoke truncate, references, trigger on public.site_events from anon, authenticated;
