-- =============================================================================
-- 0034 — Configurer la plateforme depuis son administration
--
-- Jusqu ici, chaque cle d API, chaque reglage de referencement et chaque choix
-- de fournisseur vivaient dans les variables d environnement de Vercel.
-- Consequence : changer un modele d IA demandait d ouvrir Vercel, d editer une
-- variable, puis de redeployer. Pour quelqu un qui n est pas developpeur, cela
-- revient a ne pas pouvoir administrer son produit.
--
-- Cette migration apporte trois tables, et une seule regle les gouverne :
-- **ce qui demarre le systeme reste dans l environnement, ce qui le configure
-- peut venir de la base.**
--
-- Restent dans l environnement, et ne seront jamais reglables depuis l ecran :
--   SUPABASE_SERVICE_ROLE_KEY   lit toute la base
--   SECRETS_ENCRYPTION_KEY      dechiffre cette table
--   CRON_SECRET                 ouvre les travaux planifies
--
-- La raison est mecanique, pas prudentielle : la cle qui dechiffre les secrets
-- ne peut pas etre rangee avec eux, et la cle qui lit la base ne peut pas etre
-- lue depuis la base.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Reglages non secrets
--
-- Nom du site, adresse canonique, titre par defaut, adresses de contact,
-- reglages de mesure. Rien de confidentiel : une cle, une valeur JSON.
-- -----------------------------------------------------------------------------
create table if not exists public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

alter table public.platform_settings enable row level security;

drop policy if exists "reglages: lecture plateforme" on public.platform_settings;
create policy "reglages: lecture plateforme"
  on public.platform_settings for select to authenticated
  using (public.is_platform_admin());

grant select on public.platform_settings to authenticated;

comment on table public.platform_settings is
  'Reglages non secrets de la plateforme. L ecriture passe par le serveur : aucune policy d insertion ni de mise a jour.';

-- -----------------------------------------------------------------------------
-- 2. Identifiants des fournisseurs
--
-- CE QUI EST STOCKE : la valeur chiffree en AES-256-GCM par l application, avec
-- la cle maitresse qui vit dans l environnement. La base ne detient donc jamais
-- de quoi se dechiffrer elle-meme.
--
-- CE QUI NE SORT JAMAIS : la valeur. Aucune policy de lecture n est posee sur
-- cette table, et aucun GRANT. Meme le super administrateur ne peut pas la
-- lire : l ecran affiche une empreinte et les quatre derniers caracteres, via
-- une fonction qui ne renvoie pas la colonne chiffree.
--
-- Seul le code serveur, avec la cle de service, y accede.
-- -----------------------------------------------------------------------------
create table if not exists public.provider_credentials (
  id          uuid primary key default gen_random_uuid(),
  -- 'ai', 'messaging', 'voice', 'telephony', 'search-console'...
  provider    text not null,
  -- 'api_key', 'account_sid', 'model'...
  field       text not null,
  -- Chiffre par l application. La base ne voit que du bruit.
  secret      text not null,
  -- Empreinte courte, pour verifier qu on a bien remplace la bonne cle sans
  -- jamais reveler la valeur.
  fingerprint text not null,
  -- Les quatre derniers caracteres : assez pour reconnaitre une cle dans son
  -- tableau de bord fournisseur, inutile pour s en servir.
  last4       text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null,
  unique (provider, field)
);

alter table public.provider_credentials enable row level security;

-- Aucune policy de lecture. C est volontaire : une table sans policy est
-- invisible, et c est exactement ce qu on veut d une table de secrets.
revoke all on public.provider_credentials from anon, authenticated;

comment on table public.provider_credentials is
  'Secrets des fournisseurs, chiffres. Aucune policy de lecture : meme le super administrateur ne lit jamais la valeur, seulement son empreinte.';

-- -----------------------------------------------------------------------------
-- 3. Connexion a Google Search Console
--
-- Separee des identifiants ci-dessus parce qu elle porte autre chose : un
-- jeton de rafraichissement OAuth, une propriete choisie, et un etat de
-- connexion qui s affiche.
-- -----------------------------------------------------------------------------
create table if not exists public.search_console_connection (
  id             boolean primary key default true check (id),
  -- Chiffre, comme les jetons d agenda (ADR-021).
  refresh_token  text not null,
  property       text,
  connected_at   timestamptz not null default now(),
  connected_by   uuid references auth.users(id) on delete set null,
  last_error     text,
  last_sync_at   timestamptz
);

alter table public.search_console_connection enable row level security;
revoke all on public.search_console_connection from anon, authenticated;

comment on table public.search_console_connection is
  'Connexion Search Console. Une seule ligne (id = true). Le jeton est chiffre et ne sort jamais : seul l etat est expose par une fonction.';

-- -----------------------------------------------------------------------------
-- 4. Lecture de l etat, sans jamais les valeurs
-- -----------------------------------------------------------------------------

/**
 * Ce qui est configure, et depuis quand. Jamais ce que ca vaut.
 */
create or replace function public.credentials_state()
returns table (
  provider    text,
  field       text,
  fingerprint text,
  last4       text,
  updated_at  timestamptz
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
  select c.provider, c.field, c.fingerprint, c.last4, c.updated_at
  from public.provider_credentials c
  order by c.provider, c.field;
end;
$$;

revoke all on function public.credentials_state() from public, anon;
grant execute on function public.credentials_state() to authenticated;

/** L etat de la connexion Search Console, sans le jeton. */
create or replace function public.search_console_state()
returns table (
  connected    boolean,
  property     text,
  connected_at timestamptz,
  last_error   text,
  last_sync_at timestamptz
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
  select true, c.property, c.connected_at, c.last_error, c.last_sync_at
  from public.search_console_connection c
  where c.id
  union all
  select false, null::text, null::timestamptz, null::text, null::timestamptz
  where not exists (select 1 from public.search_console_connection where id)
  limit 1;
end;
$$;

revoke all on function public.search_console_state() from public, anon;
grant execute on function public.search_console_state() to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Les reglages par defaut
--
-- Poses ici plutot que dans le code : l ecran doit pouvoir les modifier des la
-- premiere ouverture, et une valeur par defaut ecrite en dur dans deux
-- endroits finit toujours par diverger.
-- -----------------------------------------------------------------------------
insert into public.platform_settings (key, value) values
  ('site', jsonb_build_object(
    'name', 'Sophie IA',
    'title', 'Sophie IA — la secretaire qui repond pendant que vous travaillez',
    'description', 'Sophie repond au telephone pendant que vous travaillez : elle comprend la demande, consulte votre agenda, propose un rendez-vous et vous transmet tout, resume.',
    'canonical', 'https://zelicall.com',
    'locale', 'fr_BE',
    'contact_email', '',
    'support_email', '',
    'og_image', ''
  )),
  ('analytics', jsonb_build_object(
    'enabled', true,
    'exclude_internal', true
  ))
on conflict (key) do nothing;

-- Les nouvelles tables heritent des privileges par defaut : meme regle que la
-- migration 0031.
revoke truncate, references, trigger on public.platform_settings from anon, authenticated;
revoke truncate, references, trigger on public.provider_credentials from anon, authenticated;
revoke truncate, references, trigger on public.search_console_connection from anon, authenticated;
