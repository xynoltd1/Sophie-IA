-- =============================================================================
-- 0006 — Politique d enregistrement et de retention audio
-- Amendement de la Phase 0 — decision produit du 2026-09-07 (voir ADR-013)
--
-- Contexte : le produit est lance en France et en Belgique. L audio est
-- conserve au maximum 30 jours, puis supprime automatiquement. La transcription
-- et le resume survivent a cette suppression.
--
-- Ces valeurs sont des colonnes de configuration, jamais des constantes dans le
-- code : le droit applicable et la duree acceptable varient selon le pays et
-- selon le client (ADR-011).
-- =============================================================================

-- Duree de retention maximale autorisee par la politique produit, en jours.
-- Une organisation peut choisir moins, jamais plus.
create or replace function public.max_audio_retention_days()
returns int
language sql
immutable
as $$ select 30; $$;

comment on function public.max_audio_retention_days() is
  'Plafond produit de retention audio. Modifier cette fonction est une decision juridique, pas technique.';

alter table public.organizations
  -- L enregistrement est desactive par defaut : c est un choix explicite de
  -- l entreprise, jamais un reglage herite.
  add column recording_enabled boolean not null default false,

  -- Duree de conservation de l audio. Le plafond est verifie en base, pour
  -- qu aucun chemin de code ne puisse le contourner.
  add column audio_retention_days int not null default 30
    check (audio_retention_days between 1 and 30),

  -- L appelant doit-il etre informe de l enregistrement avant qu il commence ?
  -- En France et en Belgique, la reponse est oui. La colonne existe parce que
  -- ce n est pas vrai partout.
  add column recording_notice_required boolean not null default true,

  -- Texte de l annonce, personnalisable par l entreprise. Null = texte par
  -- defaut resolu au moment de l appel selon la langue et le pays.
  add column recording_notice_text text,

  -- Date a laquelle l entreprise a accepte la charte de traitement des
  -- enregistrements. Sans cette acceptation, l enregistrement reste refuse.
  add column recording_policy_accepted_at timestamptz;

-- Un garde-fou explicite plutot qu une regle implicite dans le code :
-- on ne peut pas activer l enregistrement sans avoir accepte la charte.
alter table public.organizations
  add constraint organizations_recording_requires_policy
  check (
    recording_enabled = false
    or recording_policy_accepted_at is not null
  );

comment on column public.organizations.audio_retention_days is
  'Nombre de jours de conservation de l audio original. Plafonne a 30 par la contrainte. La transcription et le resume ne sont pas concernes.';

-- -----------------------------------------------------------------------------
-- Suivi de la purge
-- La suppression effective des fichiers est realisee en Phase 5 par un job
-- planifie. Cette table trace ce qui a ete supprime, pour pouvoir le prouver.
-- -----------------------------------------------------------------------------
create table public.audio_retention_events (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Reference souple : la table des appels arrive en Phase 4.
  call_id         uuid,
  storage_path    text not null,
  recorded_at     timestamptz not null,
  purged_at       timestamptz not null default now(),
  reason          text not null default 'RETENTION_EXPIRED'
                    check (reason in ('RETENTION_EXPIRED', 'USER_REQUEST', 'ORGANIZATION_DELETED')),
  created_at      timestamptz not null default now()
);

comment on table public.audio_retention_events is
  'Preuve de suppression des enregistrements. Ne contient aucun audio ni transcription, seulement la trace de la purge.';

create index audio_retention_events_org_idx on public.audio_retention_events (organization_id, purged_at desc);

alter table public.audio_retention_events enable row level security;

-- L entreprise peut consulter la preuve que ses enregistrements ont bien ete
-- supprimes. L ecriture est reservee au job serveur (service_role).
create policy "purge audio: lire ses propres traces"
  on public.audio_retention_events for select to authenticated
  using (public.is_org_member(organization_id));
