-- =============================================================================
-- 0019 — Appels et numeros de telephone (Phase 4)
--
-- Ce que cette migration rend possible : qu un appel telephonique EXISTE dans
-- le produit. Jusqu ici, Sophie pouvait repondre a des questions metier, mais
-- aucun appel ne laissait de trace.
--
-- Deux tables, et la premiere est la plus importante pour le multi-entreprises.
--
-- `phone_numbers` fait le lien entre un numero appele et une organisation.
-- C est ce lien qui permet a Sophie de savoir chez QUI elle travaille. Sans
-- lui, un appel entrant serait orphelin, ou pire, rattache a la mauvaise
-- entreprise. Le modele retenu (ADR-022) est que l artisan garde son propre
-- numero et le renvoie vers le numero que nous lui donnons ; c est donc le
-- numero de DESTINATION qui identifie l organisation.
--
-- `calls` porte l appel lui-meme. Son etat est decoupe en quatre statuts
-- independants, et ce decoupage est volontaire (sections 12 et 16) :
-- l enregistrement, la transcription et le resume echouent separement, et un
-- echec de resume ne doit jamais faire disparaitre l audio.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'call_status') then
    create type public.call_status as enum (
      'RINGING',      -- l appel arrive, personne n a encore decroche
      'ANSWERED',     -- Sophie a decroche, la conversation est en cours
      'COMPLETED',    -- conversation terminee normalement
      'MISSED',       -- personne n a repondu
      'FAILED',       -- echec technique : rien n a eu lieu
      'TRANSFERRED'   -- passe a un humain
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'call_direction') then
    create type public.call_direction as enum ('INBOUND', 'OUTBOUND');
  end if;

  -- Un seul type pour les trois traitements post-appel : ils ont exactement le
  -- meme cycle de vie, et les distinguer n apporterait que des occasions de
  -- divergence.
  if not exists (select 1 from pg_type where typname = 'processing_status') then
    create type public.processing_status as enum (
      'NOT_APPLICABLE',  -- non demande : enregistrement desactive, par exemple
      'PENDING',         -- a faire
      'RUNNING',         -- en cours
      'DONE',
      'FAILED'           -- echoue, et reessayable
    );
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- phone_numbers — le lien numero -> organisation
-- -----------------------------------------------------------------------------
create table if not exists public.phone_numbers (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,

  -- Toujours en E.164 (+33..., +32...). La normalisation est faite par
  -- normalize_phone() de la migration 0001 : un numero saisi autrement ne doit
  -- jamais atteindre cette colonne.
  e164                 text not null check (e164 ~ '^\+[1-9][0-9]{6,14}$'),
  label                text,

  provider             text not null default 'VAPI',
  -- Identifiants chez le fournisseur. Ils servent a rattacher un evenement
  -- entrant sans faire confiance a ce que le modele raconte.
  provider_number_id   text,
  assistant_external_id text,

  -- ADR-019 et section 45 : un numero d essai ne pollue ni les statistiques,
  -- ni les vrais prospects. La frontiere entre test et production est un
  -- NUMERO DIFFERENT, pas une case a cocher — un vrai client qui appelle une
  -- ligne d essai serait enregistre sans base legale.
  is_test              boolean not null default false,
  is_active            boolean not null default true,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.phone_numbers is
  'Numeros vers lesquels les appels arrivent. Fait le lien entre un numero appele et une organisation (ADR-022 : l artisan renvoie son propre numero vers celui-ci).';

comment on column public.phone_numbers.is_test is
  'Ligne d essai. Ne doit jamais etre publiee ni communiquee a un client reel.';

-- Un numero appartient a une seule organisation. Sans cette contrainte, deux
-- organisations pourraient revendiquer le meme numero et un appel entrant
-- serait attribue au hasard.
create unique index if not exists phone_numbers_e164_unique_idx
  on public.phone_numbers (e164);

create index if not exists phone_numbers_org_idx
  on public.phone_numbers (organization_id)
  where is_active;

drop trigger if exists phone_numbers_set_updated_at on public.phone_numbers;
create trigger phone_numbers_set_updated_at
  before update on public.phone_numbers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- calls
-- -----------------------------------------------------------------------------
create table if not exists public.calls (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  phone_number_id      uuid references public.phone_numbers (id) on delete set null,

  provider             text not null default 'VAPI',
  -- L identifiant de l appel chez le fournisseur. Unique : un webhook rejoue
  -- ne doit pas creer un deuxieme appel. C est la cle d idempotence de toute
  -- la Phase 4.
  provider_call_id     text not null,

  direction            public.call_direction not null default 'INBOUND',
  from_e164            text,
  to_e164              text,

  contact_id           uuid references public.contacts (id) on delete set null,

  status               public.call_status not null default 'RINGING',

  -- Trois traitements independants (section 12). Un echec de l un n affecte
  -- pas les autres, et chacun est reessayable separement.
  recording_status     public.processing_status not null default 'NOT_APPLICABLE',
  transcription_status public.processing_status not null default 'NOT_APPLICABLE',
  summary_status       public.processing_status not null default 'NOT_APPLICABLE',

  -- Chemin dans le bucket prive. Jamais une URL publique (section 40).
  recording_path       text,
  recording_expires_at timestamptz,

  started_at           timestamptz not null default now(),
  answered_at          timestamptz,
  ended_at             timestamptz,
  duration_seconds     int check (duration_seconds is null or duration_seconds >= 0),
  ended_reason         text,

  is_test              boolean not null default false,

  -- Permet de suivre un meme appel a travers les services (section 54).
  correlation_id       uuid not null default gen_random_uuid(),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- Un appel termine a forcement une fin. Cette contrainte attrape les
  -- transitions d etat ecrites a moitie.
  constraint calls_terminal_has_end check (
    status not in ('COMPLETED', 'MISSED', 'FAILED', 'TRANSFERRED')
    or ended_at is not null
  )
);

comment on table public.calls is
  'Un appel telephonique. Les statuts d enregistrement, de transcription et de resume sont independants : un resume rate ne doit jamais faire disparaitre l audio (section 16).';

comment on column public.calls.provider_call_id is
  'Identifiant chez le fournisseur. Unique par fournisseur : un webhook rejoue ne doit pas creer un second appel.';

create unique index if not exists calls_provider_call_unique_idx
  on public.calls (provider, provider_call_id);

create index if not exists calls_org_recent_idx
  on public.calls (organization_id, started_at desc);

create index if not exists calls_contact_idx
  on public.calls (contact_id, started_at desc)
  where contact_id is not null;

-- Les appels a traiter apres coup : petit index, consulte par les jobs.
create index if not exists calls_pending_processing_idx
  on public.calls (organization_id, started_at)
  where transcription_status in ('PENDING', 'FAILED')
     or summary_status in ('PENDING', 'FAILED');

drop trigger if exists calls_set_updated_at on public.calls;
create trigger calls_set_updated_at
  before update on public.calls
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.phone_numbers enable row level security;
alter table public.calls         enable row level security;

drop policy if exists "numeros: lecture par les membres" on public.phone_numbers;
create policy "numeros: lecture par les membres"
  on public.phone_numbers for select to authenticated
  using (public.is_org_member(organization_id));

-- L attribution d un numero est une operation d administration : elle engage
-- une facturation et determine quels appels arrivent chez qui. Elle passe par
-- le serveur, pas par le navigateur.
drop policy if exists "numeros: administration" on public.phone_numbers;
create policy "numeros: administration"
  on public.phone_numbers for update to authenticated
  using (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]));

drop policy if exists "appels: lecture par les membres" on public.calls;
create policy "appels: lecture par les membres"
  on public.calls for select to authenticated
  using (public.is_org_member(organization_id));

-- Aucune policy d ecriture sur `calls` pour `authenticated`, et c est voulu :
-- un appel est un FAIT constate par le fournisseur de telephonie. Le navigateur
-- ne doit jamais pouvoir en inventer un, ni modifier sa duree. Toutes les
-- ecritures passent par le client d administration cote serveur.

-- -----------------------------------------------------------------------------
-- Privileges (voir 0012 : sans GRANT, la policy n est jamais atteinte)
-- -----------------------------------------------------------------------------
grant select          on public.phone_numbers to authenticated;
grant update          on public.phone_numbers to authenticated;
grant select          on public.calls         to authenticated;

-- -----------------------------------------------------------------------------
-- organization_for_number — qui est concerne par cet appel ?
--
-- Appelee cote serveur, avec le numero APPELE. Volontairement stricte : un
-- numero inconnu ou desactive ne renvoie rien, plutot que de deviner. Mieux
-- vaut un appel refuse qu un appel attribue a la mauvaise entreprise.
-- -----------------------------------------------------------------------------
create or replace function public.organization_for_number(numero text)
returns table (organization_id uuid, phone_number_id uuid, is_test boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select n.organization_id, n.id, n.is_test
  from public.phone_numbers n
  where n.e164 = public.normalize_phone(numero)
    and n.is_active
  limit 1;
$$;

revoke all on function public.organization_for_number(text) from public, anon, authenticated;

comment on function public.organization_for_number(text) is
  'Resout le numero APPELE en organisation. Reserve au serveur : la resolution ne doit jamais dependre de ce que le navigateur ou le modele annonce.';

-- -----------------------------------------------------------------------------
-- La transparence sur la nature d IA n est plus desactivable
--
-- L article 50 du reglement europeen sur l IA est applicable depuis le
-- 2 aout 2026 : une personne doit savoir qu elle parle a un systeme
-- automatise. Les sanctions vont jusqu a 15 M EUR ou 3 % du chiffre
-- d affaires mondial.
--
-- `disclose_ai` etait un reglage modifiable. Ce n en est plus un. La colonne
-- est conservee pour ne rien casser, mais elle est forcee a `true` : un client
-- ne peut pas desactiver une obligation legale depuis son tableau de bord, et
-- c est NOUS qui serions en faute de le lui avoir permis.
-- -----------------------------------------------------------------------------
update public.sophie_configurations set disclose_ai = true where disclose_ai = false;

alter table public.sophie_configurations
  drop constraint if exists sophie_disclose_ai_obligatoire;

alter table public.sophie_configurations
  add constraint sophie_disclose_ai_obligatoire check (disclose_ai = true);

alter table public.sophie_configurations
  alter column disclose_ai set default true;

comment on column public.sophie_configurations.disclose_ai is
  'Toujours vrai. Obligation de transparence de l article 50 du reglement (UE) 2024/1689, applicable depuis le 2026-08-02. Conservee comme colonne pour la compatibilite, verrouillee par contrainte.';
