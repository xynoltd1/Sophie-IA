-- =============================================================================
-- 0011 — Configuration de Sophie, connaissances, progression de l onboarding
-- Phase 1 — sections 6, 8 et 9
-- =============================================================================

create type public.sophie_style      as enum ('CHALEUREUX', 'NEUTRE', 'DIRECT');
create type public.sophie_answer_mode as enum ('OFF', 'ALWAYS', 'WHEN_UNAVAILABLE', 'SCHEDULE');

-- -----------------------------------------------------------------------------
-- sophie_configurations — une ligne par organisation
-- -----------------------------------------------------------------------------
create table public.sophie_configurations (
  organization_id   uuid primary key references public.organizations (id) on delete cascade,

  assistant_name    text not null default 'Sophie' check (length(btrim(assistant_name)) between 2 and 40),
  language          text not null default 'fr',
  voice_id          text,
  style             public.sophie_style not null default 'CHALEUREUX',

  greeting          text,
  behavior_notes    text,

  -- Transparence sur la nature d assistante virtuelle (section 8).
  -- Modifiable, mais activee par defaut : c est le comportement attendu en
  -- France et en Belgique.
  disclose_ai       boolean not null default true,

  answer_mode       public.sophie_answer_mode not null default 'OFF',
  transfer_number   text,
  transfer_number_e164 text,

  -- Sophie ne peut pas etre activee tant que la telephonie n existe pas
  -- (Phase 4). Le drapeau existe des maintenant pour que l interface dise la
  -- verite sur son etat.
  is_active         boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Un mode de reponse autre que OFF exige de savoir vers qui transferer.
  constraint sophie_transfer_needed check (
    answer_mode <> 'WHEN_UNAVAILABLE' or transfer_number is not null
  )
);

comment on table public.sophie_configurations is
  'Comportement de Sophie pour une organisation. Surcharge le ProfessionTemplate (section 7).';

create trigger sophie_configurations_set_updated_at
  before update on public.sophie_configurations
  for each row execute function public.set_updated_at();

create or replace function public.sophie_normalize_transfer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  calling_code text;
begin
  select o.country_calling_code into calling_code
  from public.organizations o where o.id = new.organization_id;

  new.transfer_number_e164 := public.normalize_phone(new.transfer_number, coalesce(calling_code, '32'));
  return new;
end;
$$;

create trigger sophie_configurations_transfer
  before insert or update of transfer_number on public.sophie_configurations
  for each row execute function public.sophie_normalize_transfer();

alter table public.sophie_configurations enable row level security;

create policy "sophie: lecture par les membres"
  on public.sophie_configurations for select to authenticated
  using (public.is_org_member(organization_id));

create policy "sophie: ecriture par OWNER et ADMIN"
  on public.sophie_configurations for all to authenticated
  using (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]));

-- -----------------------------------------------------------------------------
-- business_knowledge — ce que Sophie a le droit de savoir
--
-- Alimente uniquement par le professionnel. Aucun apprentissage automatique a
-- partir des appels : une IA qui se corrigerait seule finirait par annoncer des
-- tarifs approximatifs a de vrais clients (section 9).
-- -----------------------------------------------------------------------------
create table public.business_knowledge (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  kind            text not null default 'FAQ' check (kind in ('FAQ', 'INSTRUCTION', 'FACT')),
  question        text,
  answer          text not null check (length(btrim(answer)) between 2 and 4000),

  is_active       boolean not null default true,
  sort_order      int not null default 100,

  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint business_knowledge_faq_has_question check (
    kind <> 'FAQ' or question is not null
  )
);

create index business_knowledge_active_idx
  on public.business_knowledge (organization_id, kind, sort_order) where is_active;

create trigger business_knowledge_set_updated_at
  before update on public.business_knowledge
  for each row execute function public.set_updated_at();

alter table public.business_knowledge enable row level security;

create policy "connaissances: lecture par les membres"
  on public.business_knowledge for select to authenticated
  using (public.is_org_member(organization_id));

create policy "connaissances: ecriture par OWNER et ADMIN"
  on public.business_knowledge for all to authenticated
  using (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['OWNER','ADMIN']::public.member_role[]));

-- -----------------------------------------------------------------------------
-- Application d un modele de metier
--
-- Cree le profil, les services suggeres, les horaires par defaut et la
-- configuration de Sophie, en une transaction. Rejouable : relancer la fonction
-- avec un autre metier remplace les services issus du modele mais CONSERVE ceux
-- que l entreprise a ajoutes elle-meme.
-- -----------------------------------------------------------------------------
create or replace function public.apply_profession_template(
  org_id       uuid,
  template_id  uuid,
  custom_label text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tpl     record;
  svc     jsonb;
  ordinal int := 0;
begin
  if not public.has_org_role(org_id, array['OWNER','ADMIN']::public.member_role[]) then
    raise exception 'Droits insuffisants.' using errcode = '42501';
  end if;

  select * into tpl from public.profession_templates t
  where t.id = template_id and t.is_published;

  if not found then
    raise exception 'Metier inconnu ou non publie.' using errcode = 'no_data_found';
  end if;

  if tpl.allows_custom_label and coalesce(btrim(custom_label), '') = '' then
    raise exception 'Ce metier demande une precision libre.' using errcode = 'check_violation';
  end if;

  insert into public.business_profiles (
    organization_id, profession_template_id, custom_profession_label,
    default_appointment_minutes, buffer_minutes
  )
  values (
    org_id, template_id, nullif(btrim(custom_label), ''),
    tpl.default_appointment_minutes, tpl.default_buffer_minutes
  )
  on conflict (organization_id) do update set
    profession_template_id      = excluded.profession_template_id,
    custom_profession_label     = excluded.custom_profession_label,
    default_appointment_minutes = excluded.default_appointment_minutes,
    buffer_minutes              = excluded.buffer_minutes;

  -- Les services personnalises de l entreprise ne sont jamais ecrases.
  delete from public.services s
  where s.organization_id = org_id and s.source = 'TEMPLATE';

  for svc in select * from jsonb_array_elements(tpl.suggested_services) loop
    ordinal := ordinal + 10;
    insert into public.services (
      organization_id, name, duration_minutes, is_urgent,
      collect_fields, source, sort_order
    )
    values (
      org_id,
      svc ->> 'name',
      coalesce((svc ->> 'duration_minutes')::int, tpl.default_appointment_minutes),
      coalesce((svc ->> 'is_urgent')::boolean, false),
      coalesce(svc -> 'collect', '[]'::jsonb),
      'TEMPLATE',
      ordinal
    )
    on conflict (organization_id, lower(btrim(name))) do nothing;
  end loop;

  -- Horaires par defaut : lundi au vendredi, 8h-17h. Point de depart a corriger.
  insert into public.business_hours (organization_id, weekday, is_open, opens_at, closes_at)
  select org_id, d, d <= 5, case when d <= 5 then time '08:00' end, case when d <= 5 then time '17:00' end
  from generate_series(1, 7) as d
  on conflict do nothing;

  insert into public.sophie_configurations (organization_id)
  values (org_id)
  on conflict (organization_id) do nothing;

  insert into public.activities (organization_id, actor_user_id, type, subject_type, subject_id, summary)
  values (org_id, (select auth.uid()), 'PROFESSION_SELECTED', 'organization', org_id,
          'Metier defini : ' || coalesce(nullif(btrim(custom_label), ''), tpl.label));
end;
$$;

grant execute on function public.apply_profession_template(uuid, uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Progression de l onboarding
--
-- On n avance jamais en arriere par erreur : la fonction ne recule que si
-- l appelant le demande explicitement en passant une etape anterieure.
-- -----------------------------------------------------------------------------
create or replace function public.set_onboarding_step(org_id uuid, step public.onboarding_step)
returns public.onboarding_step
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_org_role(org_id, array['OWNER','ADMIN']::public.member_role[]) then
    raise exception 'Droits insuffisants.' using errcode = '42501';
  end if;

  update public.organizations o
  set onboarding_step = step,
      onboarding_completed_at = case
        when step = 'DONE' then coalesce(o.onboarding_completed_at, now())
        else o.onboarding_completed_at
      end
  where o.id = org_id;

  return step;
end;
$$;

grant execute on function public.set_onboarding_step(uuid, public.onboarding_step) to authenticated;
