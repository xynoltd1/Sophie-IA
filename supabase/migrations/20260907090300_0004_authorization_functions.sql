-- =============================================================================
-- 0003 — Fonctions d autorisation
-- Phase 0 — socle des policies RLS
--
-- Pourquoi SECURITY DEFINER ?
-- Les policies de public.organization_members doivent interroger
-- public.organization_members. Si la lecture passait par RLS, Postgres
-- boucherait (recursion infinie). Ces fonctions s executent donc avec les
-- droits du proprietaire et contournent RLS, ce qui est sur ici parce que :
--   - elles ne renvoient que des booleens ou le role de l appelant ;
--   - elles filtrent systematiquement sur auth.uid() ;
--   - search_path est fige (protection contre le detournement de schema).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Membre actif d une organisation ?
-- -----------------------------------------------------------------------------
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and m.status  = 'ACTIVE'
  );
$$;

-- -----------------------------------------------------------------------------
-- Role de l appelant dans une organisation (null s il n est pas membre actif)
-- -----------------------------------------------------------------------------
create or replace function public.org_role(org_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.organization_members m
  where m.organization_id = org_id
    and m.user_id = (select auth.uid())
    and m.status  = 'ACTIVE'
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- L appelant possede-t-il l un des roles demandes ?
-- -----------------------------------------------------------------------------
create or replace function public.has_org_role(org_id uuid, allowed public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.org_role(org_id) = any (allowed);
$$;

-- -----------------------------------------------------------------------------
-- Administrateur de la plateforme (console Super Admin, section 37)
-- -----------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.is_platform_admin
     from public.profiles p
     where p.id = (select auth.uid())),
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- Organisations accessibles a l appelant (utilise par l application serveur)
-- -----------------------------------------------------------------------------
create or replace function public.my_organizations()
returns table (
  organization_id uuid,
  name            text,
  slug            citext,
  role            public.member_role,
  onboarding_step public.onboarding_step,
  onboarding_completed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o.id, o.name, o.slug, m.role, o.onboarding_step, o.onboarding_completed_at
  from public.organizations o
  join public.organization_members m on m.organization_id = o.id
  where m.user_id = (select auth.uid())
    and m.status  = 'ACTIVE'
    and o.deleted_at is null
  order by o.created_at asc;
$$;

-- -----------------------------------------------------------------------------
-- Creation d une organisation
-- Chicken-and-egg : on ne peut pas etre membre d une organisation qui n existe
-- pas encore. Cette fonction cree l organisation ET l appartenance OWNER dans
-- une seule transaction, plutot que d ouvrir une policy INSERT permissive.
-- -----------------------------------------------------------------------------
create or replace function public.create_organization(
  org_name             text,
  org_country_code     text default 'BE',
  org_country_calling_code text default '32',
  org_timezone         text default 'Europe/Brussels',
  org_locale           text default 'fr'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id      uuid;
  base_slug   text;
  final_slug  text;
  suffix      int := 0;
  caller      uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;

  base_slug := coalesce(public.slugify(org_name), 'entreprise');
  final_slug := base_slug;

  while exists (select 1 from public.organizations o where o.slug = final_slug) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix::text;
  end loop;

  insert into public.organizations (
    name, slug, country_code, country_calling_code, timezone, locale, created_by
  )
  values (
    btrim(org_name), final_slug, org_country_code, org_country_calling_code,
    org_timezone, org_locale, caller
  )
  returning id into new_id;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (new_id, caller, 'OWNER', 'ACTIVE');

  insert into public.activities (organization_id, actor_user_id, type, subject_type, subject_id, summary)
  values (new_id, caller, 'ORGANIZATION_CREATED', 'organization', new_id,
          'Entreprise creee : ' || btrim(org_name));

  return new_id;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text) from public;
grant execute on function public.create_organization(text, text, text, text, text) to authenticated;

revoke all on function public.my_organizations() from public;
grant execute on function public.my_organizations() to authenticated;
