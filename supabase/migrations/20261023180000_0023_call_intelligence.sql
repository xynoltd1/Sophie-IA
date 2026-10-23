-- =============================================================================
-- 0023 — Transcription, resume et trace brute des appels (Phase 5)
--
-- Trois objets, et leur separation est le coeur de la section 16 : un echec de
-- resume ne doit jamais faire disparaitre la transcription, et un echec de
-- transcription ne doit jamais faire disparaitre l audio.
--
-- `call_events` garde le rapport BRUT du fournisseur. C est la source, et elle
-- survit a nos erreurs d interpretation. Deux raisons de la conserver :
--   - rejouer une extraction ratee sans redemander quoi que ce soit au
--     fournisseur, qui ne garde pas ses rapports indefiniment ;
--   - construire l extraction sur la forme reelle des donnees plutot que sur
--     une documentation. Le projet a deja paye le prix d un adaptateur ecrit
--     contre une API devinee.
--
-- `call_transcript_segments` porte la conversation ligne par ligne, avec le
-- moment ou chaque phrase a ete dite. Ce dernier point n est pas decoratif : la
-- section 14 demande de pouvoir cliquer sur un passage et y placer le lecteur
-- audio. Sans l horodatage enregistre des maintenant, cette fonction
-- demanderait de retraiter tous les appels passes.
--
-- `calls.summary` et `calls.structured_data` portent le resultat lisible.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- call_events — la trace brute
-- -----------------------------------------------------------------------------
create table if not exists public.call_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  call_id         uuid references public.calls (id) on delete cascade,

  provider        text not null default 'VAPI',
  -- Le type tel que le fournisseur le nomme, sans traduction : c est une trace,
  -- pas une interpretation.
  type            text not null,
  payload         jsonb not null,

  received_at     timestamptz not null default now(),
  -- Meme horizon que l audio (ADR-018, section 42) : ce rapport contient la
  -- transcription, donc des donnees personnelles. Il se purge avec le reste.
  expires_at      timestamptz not null default (now() + interval '30 days'),

  created_at      timestamptz not null default now()
);

comment on table public.call_events is
  'Rapports bruts du fournisseur de voix. Source rejouable de la transcription et du resume ; contient des donnees personnelles et se purge comme l audio.';

create index if not exists call_events_call_idx
  on public.call_events (call_id, received_at desc) where call_id is not null;
create index if not exists call_events_org_idx
  on public.call_events (organization_id, received_at desc);
create index if not exists call_events_expiry_idx
  on public.call_events (expires_at);

-- Un rapport rejoue ne doit pas creer une seconde ligne.
--
-- Index NON partiel, et c est deliberé : un index unique partiel ne peut pas
-- servir d arbitre a `ON CONFLICT (call_id, type)` — PostgreSQL exige alors de
-- repeter la condition, ce que le client ne sait pas faire. C est exactement
-- l erreur de l ADR-025, et `tests/upsert-constraints.test.ts` l a rattrapee
-- avant le deploiement cette fois.
--
-- Les lignes sans appel rattache ne s excluent donc pas entre elles, puisque
-- deux NULL sont distincts. C est le comportement voulu : un evenement
-- orphelin appartient a un appel inconnu, pas au meme appel.
create unique index if not exists call_events_unique_idx
  on public.call_events (call_id, type);

-- -----------------------------------------------------------------------------
-- call_transcript_segments — la conversation, dans l ordre
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'transcript_speaker') then
    create type public.transcript_speaker as enum (
      'SOPHIE',   -- l assistante
      'CLIENT',   -- l appelant
      'SYSTEME'   -- instruction ou outil : conserve, mais jamais affiche au client
    );
  end if;
end
$$;

create table if not exists public.call_transcript_segments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  call_id         uuid not null references public.calls (id) on delete cascade,

  -- Rang dans la conversation. Nomme `ordinal` et non `position` : ce dernier
  -- est un mot-cle SQL, et un nom de colonne qui oblige a citer est un piege
  -- qu on tend a la prochaine requete. Sert aussi de cle d idempotence : un
  -- rapport rejoue reecrit les memes rangs au lieu de doubler la transcription.
  ordinal        int  not null check (ordinal >= 0),
  speaker         public.transcript_speaker not null,
  content         text not null,

  -- Millisecondes depuis le debut de l appel. Null quand le fournisseur ne les
  -- donne pas : une valeur inventee serait pire qu une absence, parce qu elle
  -- placerait le lecteur audio au mauvais endroit.
  started_ms      int check (started_ms is null or started_ms >= 0),
  ended_ms        int check (ended_ms is null or ended_ms >= 0),

  created_at      timestamptz not null default now()
);

comment on table public.call_transcript_segments is
  'Transcription conversationnelle d un appel (section 14). started_ms permet de placer le lecteur audio sur un passage.';

create unique index if not exists call_transcript_position_idx
  on public.call_transcript_segments (call_id, ordinal);
create index if not exists call_transcript_call_idx
  on public.call_transcript_segments (call_id, ordinal);

-- -----------------------------------------------------------------------------
-- Le resultat lisible, porte par l appel lui-meme
-- -----------------------------------------------------------------------------
alter table public.calls
  add column if not exists summary text,
  add column if not exists structured_data jsonb;

comment on column public.calls.summary is
  'Resume lisible produit apres l appel. Null tant qu il n existe pas : summary_status dit pourquoi.';
comment on column public.calls.structured_data is
  'Champs extraits de la conversation (section 15). Une valeur inconnue reste absente, jamais devinee.';

-- -----------------------------------------------------------------------------
-- RLS et privileges
--
-- Lecture par les membres, aucune ecriture depuis le navigateur : une
-- transcription est un fait constate, pas une donnee saisie. Tout passe par le
-- client d administration cote serveur.
-- -----------------------------------------------------------------------------
alter table public.call_events               enable row level security;
alter table public.call_transcript_segments  enable row level security;

drop policy if exists "evenements d appel: lecture par les membres" on public.call_events;
create policy "evenements d appel: lecture par les membres"
  on public.call_events for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "transcription: lecture par les membres" on public.call_transcript_segments;
create policy "transcription: lecture par les membres"
  on public.call_transcript_segments for select to authenticated
  using (public.is_org_member(organization_id));

grant select on public.call_events              to authenticated;
grant select on public.call_transcript_segments to authenticated;

-- -----------------------------------------------------------------------------
-- Purge des rapports bruts
--
-- Appelee par la meme tache planifiee que la purge audio. Renvoie le nombre de
-- lignes supprimees pour que la purge soit constatable et non supposee.
-- -----------------------------------------------------------------------------
create or replace function public.purge_expired_call_events()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  supprimes int;
begin
  delete from public.call_events where expires_at < now();
  get diagnostics supprimes = row_count;
  return supprimes;
end;
$$;

revoke all on function public.purge_expired_call_events() from public, anon, authenticated;

comment on function public.purge_expired_call_events() is
  'Supprime les rapports bruts arrives a echeance. Reservee au serveur.';
