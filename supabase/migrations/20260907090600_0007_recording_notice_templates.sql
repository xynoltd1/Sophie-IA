-- =============================================================================
-- 0007 — Modeles d annonce telephonique
-- Amendement de la Phase 0 — voir ADR-015 et docs/LEGAL_COMPLIANCE.md (L9)
--
-- Le texte annonce a l appelant avant l enregistrement est une DONNEE, pas du
-- code : il varie selon le pays, la langue et l entreprise, et il doit pouvoir
-- etre corrige par un juriste sans deploiement.
--
-- Aucun texte livre par defaut n est juridiquement valide. Le champ
-- is_legally_validated vaut false, et le systeme refuse d activer
-- l enregistrement en production tant qu il n a pas ete passe a true par une
-- personne habilitee.
-- =============================================================================

create table public.recording_notice_templates (
  id                   uuid primary key default gen_random_uuid(),

  -- null = modele universel de repli ; sinon, pays ISO 3166-1 alpha-2.
  country_code         text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  locale               text not null default 'fr',

  -- {{organization}} est remplace au moment de l appel.
  body                 text not null check (length(btrim(body)) between 20 and 2000),

  -- Faux par defaut, toujours. Passer a true est un acte juridique, pas
  -- technique : la colonne suivante enregistre qui l a fait.
  is_legally_validated boolean not null default false,
  validated_by         text,
  validated_at         timestamptz,
  validation_reference text,

  is_active            boolean not null default true,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- Un modele valide doit dire par qui et quand.
  constraint recording_notice_validation_traceable check (
    is_legally_validated = false
    or (validated_by is not null and validated_at is not null)
  )
);

comment on table public.recording_notice_templates is
  'Textes d annonce lus a l appelant avant enregistrement. Modifiables sans deploiement. Aucun n est valide par defaut.';

create unique index recording_notice_templates_unique
  on public.recording_notice_templates (coalesce(country_code, '*'), locale)
  where is_active;

create trigger recording_notice_templates_set_updated_at
  before update on public.recording_notice_templates
  for each row execute function public.set_updated_at();

alter table public.recording_notice_templates enable row level security;

-- Lecture par tout utilisateur connecte : le texte doit etre affichable dans
-- les parametres. Ecriture reservee a la plateforme (console d administration).
create policy "annonces: lecture"
  on public.recording_notice_templates for select to authenticated
  using (is_active);

create policy "annonces: ecriture plateforme"
  on public.recording_notice_templates for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- Modeles de depart — PLACEHOLDERS, NON VALIDES JURIDIQUEMENT
-- -----------------------------------------------------------------------------
insert into public.recording_notice_templates (country_code, locale, body, is_legally_validated, notes)
values
  ('FR', 'fr',
   'Bonjour, vous êtes en relation avec l''assistante virtuelle de {{organization}}. Cet appel est enregistré afin de traiter votre demande. Vous pouvez vous y opposer ou demander à parler directement à un membre de l''équipe.',
   false,
   'PLACEHOLDER — NON VALIDE JURIDIQUEMENT. Rédigé par l''équipe technique pour le développement. Doit être remplacé par un texte validé (checklist L9).'),
  ('BE', 'fr',
   'Bonjour, vous êtes en relation avec l''assistante virtuelle de {{organization}}. Cet appel est enregistré afin de traiter votre demande. Vous pouvez vous y opposer ou demander à parler directement à un membre de l''équipe.',
   false,
   'PLACEHOLDER — NON VALIDE JURIDIQUEMENT. Voir checklist L9.'),
  ('BE', 'nl',
   'Goedendag, u spreekt met de virtuele assistente van {{organization}}. Dit gesprek wordt opgenomen om uw vraag te behandelen. U kunt hiertegen bezwaar maken of vragen om rechtstreeks met een medewerker te spreken.',
   false,
   'PLACEHOLDER — NON VALIDE JURIDIQUEMENT. Traduction de travail, à faire relire. Voir checklist L9.'),
  (null, 'fr',
   'Bonjour, vous êtes en relation avec l''assistante virtuelle de {{organization}}. Cet appel est enregistré afin de traiter votre demande.',
   false,
   'PLACEHOLDER de repli — NON VALIDE JURIDIQUEMENT. Ne doit jamais atteindre la production.');

-- -----------------------------------------------------------------------------
-- Resolution du modele applicable
-- Ordre : modele du pays dans la langue demandee, puis pays en francais,
-- puis modele universel.
-- -----------------------------------------------------------------------------
create or replace function public.resolve_recording_notice(org_id uuid)
returns table (
  body                 text,
  is_legally_validated boolean,
  source               text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  org record;
begin
  select o.name, o.country_code, o.locale, o.recording_notice_text
  into org
  from public.organizations o
  where o.id = org_id;

  if not found then
    raise exception 'Organisation introuvable.' using errcode = 'no_data_found';
  end if;

  -- Texte personnalise par l entreprise : jamais considere comme valide, car
  -- il n a pas ete relu par un juriste.
  if org.recording_notice_text is not null then
    return query
      select replace(org.recording_notice_text, '{{organization}}', org.name),
             false,
             'ORGANIZATION_CUSTOM';
    return;
  end if;

  return query
    select replace(t.body, '{{organization}}', org.name),
           t.is_legally_validated,
           coalesce(t.country_code, '*') || '/' || t.locale
    from public.recording_notice_templates t
    where t.is_active
      and (t.country_code = org.country_code or t.country_code is null)
      and (t.locale = org.locale or t.locale = 'fr')
    order by
      (t.country_code is not null) desc,
      (t.locale = org.locale) desc
    limit 1;
end;
$$;

grant execute on function public.resolve_recording_notice(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Garde-fou : pas d enregistrement en production sans annonce validee
--
-- La verification est en base parce qu un controle applicatif peut etre
-- contourne par un oubli. is_test permet aux appels de developpement et de
-- demonstration de continuer a fonctionner.
-- -----------------------------------------------------------------------------
create or replace function public.recording_allowed(org_id uuid, is_test boolean default false)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  org      record;
  notice   record;
begin
  select o.recording_enabled, o.recording_policy_accepted_at, o.recording_notice_required
  into org
  from public.organizations o
  where o.id = org_id;

  if not found or not org.recording_enabled then
    return false;
  end if;

  if org.recording_policy_accepted_at is null then
    return false;
  end if;

  -- Les appels de test n engagent aucun tiers reel.
  if is_test then
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
  'Autorise l enregistrement d un appel reel uniquement si l annonce applicable a ete juridiquement validee. Voir docs/LEGAL_COMPLIANCE.md (L9).';

grant execute on function public.recording_allowed(uuid, boolean) to authenticated;
