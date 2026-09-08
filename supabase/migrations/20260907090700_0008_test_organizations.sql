-- =============================================================================
-- 0008 — Organisations de test
-- Amendement de la Phase 0 — voir ADR-019
--
-- Probleme resolu ici : jusqu a present, is_test etait declaratif. N importe
-- quel appel pouvait etre marque « test » et echapper ainsi a l exigence
-- d annonce validee — y compris un appel d un vrai client, par erreur ou par
-- facilite.
--
-- Desormais, le mode test est une propriete de l ORGANISATION, pas de l appel.
-- Une organisation normale ne peut pas produire d appel de test. Le scenario
-- « on laisse tourner deux jours sur le vrai numero, juste pour voir » devient
-- impossible au niveau de la base.
-- =============================================================================

alter table public.organizations
  -- Organisation dediee aux essais. Aucune donnee de tiers reel ne doit y
  -- transiter. Ne peut etre activee que par la plateforme.
  add column is_test_organization boolean not null default false,
  add column test_mode_enabled_by uuid references auth.users (id) on delete set null,
  add column test_mode_enabled_at timestamptz;

comment on column public.organizations.is_test_organization is
  'Organisation d essai. Seule une organisation de test peut produire des appels is_test = true (voir recording_allowed).';

-- Tracabilite : on doit pouvoir dire qui a fait d une organisation une
-- organisation de test, et quand.
alter table public.organizations
  add constraint organizations_test_mode_traceable check (
    is_test_organization = false
    or (test_mode_enabled_by is not null and test_mode_enabled_at is not null)
  );

create index organizations_test_idx
  on public.organizations (id) where is_test_organization;

-- -----------------------------------------------------------------------------
-- Seule la plateforme bascule une organisation en mode test
--
-- La policy UPDATE de organizations autorise OWNER et ADMIN a modifier leur
-- organisation. Sans ce trigger, un proprietaire pourrait cocher lui-meme la
-- case et contourner l exigence d annonce validee. Le controle est en base
-- plutot que dans une policy parce qu il porte sur la TRANSITION, pas sur la
-- ligne.
-- -----------------------------------------------------------------------------
create or replace function public.guard_test_organization_flag()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_test_organization is distinct from old.is_test_organization then
    if not public.is_platform_admin() then
      raise exception
        'Le mode test ne peut etre modifie que par l administration de la plateforme.'
        using errcode = '42501';
    end if;

    if new.is_test_organization then
      new.test_mode_enabled_by := (select auth.uid());
      new.test_mode_enabled_at := now();
    else
      new.test_mode_enabled_by := null;
      new.test_mode_enabled_at := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger organizations_guard_test_flag
  before update on public.organizations
  for each row execute function public.guard_test_organization_flag();

-- -----------------------------------------------------------------------------
-- recording_allowed — version durcie
--
-- Un appel ne peut etre considere comme un test que si l organisation elle-meme
-- est une organisation de test. Sinon, is_test est ignore : l appel est traite
-- comme reel et l annonce validee redevient obligatoire.
-- -----------------------------------------------------------------------------
create or replace function public.recording_allowed(org_id uuid, is_test boolean default false)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  org    record;
  notice record;
begin
  select o.recording_enabled,
         o.recording_policy_accepted_at,
         o.recording_notice_required,
         o.is_test_organization
  into org
  from public.organizations o
  where o.id = org_id;

  if not found or not org.recording_enabled then
    return false;
  end if;

  if org.recording_policy_accepted_at is null then
    return false;
  end if;

  -- Le drapeau d appel n a d effet que dans une organisation de test.
  -- Ailleurs, il est purement et simplement ignore.
  if is_test and org.is_test_organization then
    return true;
  end if;

  if not org.recording_notice_required then
    return true;
  end if;

  select * into notice from public.resolve_recording_notice(org_id) limit 1;

  if notice is null then
    return false;
  end if;

  return notice.is_legally_validated;
end;
$$;

comment on function public.recording_allowed(uuid, boolean) is
  'Autorise l enregistrement d un appel. Un appel de test n est reconnu que dans une organisation de test. Voir docs/LEGAL_COMPLIANCE.md (L9) et ADR-019.';

-- -----------------------------------------------------------------------------
-- Qualification effective d un appel
--
-- Fonction unique utilisee par le moteur d appel a partir de la Phase 4 : elle
-- dit si un appel DOIT etre traite comme un test, quelle que soit l intention
-- exprimee par l appelant du code.
-- -----------------------------------------------------------------------------
create or replace function public.call_is_test(org_id uuid, requested_test boolean default false)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select requested_test
     and coalesce(
       (select o.is_test_organization from public.organizations o where o.id = org_id),
       false
     );
$$;

comment on function public.call_is_test(uuid, boolean) is
  'Un appel n est un test que si l organisation est une organisation de test. Empeche qu un appel reel soit marque test.';

grant execute on function public.call_is_test(uuid, boolean) to authenticated;
