-- =============================================================================
-- 0025 — Resume et extraction produits par nous (Phase 5, section 15 et 16)
--
-- Pourquoi ce changement de strategie.
--
-- Le fournisseur de voix sait produire un resume. Le 23 octobre, il a accepte
-- notre plan d analyse, l a stocke, l a renvoye tel quel quand on l
-- interrogeait — et a execute les appels avec `enabled: false`. Trois
-- corrections successives n y ont rien change. Une fonction du produit ne peut
-- pas dependre d un reglage dont l etat affiche ne correspond pas a l etat
-- reel (ADR-031).
--
-- Le resume est donc produit chez nous, a partir de la transcription deja
-- conservee en base. Ce qui change, pour l utilisateur : rien. Ce qui change,
-- pour le produit : on peut le reessayer, le corriger, et savoir pourquoi il a
-- echoue.
-- =============================================================================

alter table public.calls
  add column if not exists summary_attempts     int not null default 0,
  add column if not exists summary_error        text,
  add column if not exists summary_source       text,
  add column if not exists summary_generated_at timestamptz;

comment on column public.calls.summary_attempts is
  'Nombre de tentatives de resume. Au-dela du plafond applicatif, la reprise automatique s arrete ; la relance manuelle reste possible.';
comment on column public.calls.summary_error is
  'Pourquoi la derniere tentative a echoue. Affiche au professionnel : un echec muet est pire qu un echec explique (section 16).';
comment on column public.calls.summary_source is
  'Qui a produit le resume : nom du fournisseur, ou MOCK. Un resume simule ne doit jamais passer pour un vrai.';

-- Les appels qui attendent encore leur resume. Index partiel : seules ces
-- lignes-la sont lues par la reprise planifiee, et elles sont rares.
create index if not exists calls_summary_pending_idx
  on public.calls (organization_id, started_at)
  where summary_status in ('PENDING', 'FAILED');

-- -----------------------------------------------------------------------------
-- Les appels a reprendre, pour le travail planifie
--
-- Reservee au serveur. Ne renvoie que ce qui a une chance d aboutir : une
-- transcription existe, le plafond de tentatives n est pas atteint, et l appel
-- est termine.
-- -----------------------------------------------------------------------------
create or replace function public.calls_awaiting_summary(
  plafond_tentatives int default 3,
  limite int default 25
)
returns table (call_id uuid, organization_id uuid, tentatives int)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.organization_id, c.summary_attempts
  from public.calls c
  where c.summary_status in ('PENDING', 'FAILED')
    and c.summary_attempts < greatest(0, plafond_tentatives)
    and c.ended_at is not null
    and exists (
      select 1 from public.call_transcript_segments s where s.call_id = c.id
    )
  order by c.started_at desc
  limit greatest(1, least(limite, 200));
$$;

revoke all on function public.calls_awaiting_summary(int, int) from public, anon, authenticated;

comment on function public.calls_awaiting_summary(int, int) is
  'Appels dont le resume reste a produire et peut encore aboutir. Reservee au serveur.';
