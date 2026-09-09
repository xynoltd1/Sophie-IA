-- =============================================================================
-- 0014 — Recherche globale et tableau de bord
-- Phase 2 — sections 30 et 33
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Recherche globale (section 33)
--
-- Trois façons de chercher, dans une seule fonction : par nom, par entreprise,
-- par ville — et par telephone, qui merite un traitement a part. L artisan tape
-- « 0470 » ou « 0470123456 » indifferemment ; on normalise avant de comparer,
-- sinon la recherche la plus utile du produit ne trouve rien.
-- -----------------------------------------------------------------------------
create or replace function public.search_crm(org_id uuid, terme text, limite int default 20)
returns table (
  kind        text,     -- 'contact' | 'lead'
  id          uuid,
  title       text,
  subtitle    text,
  status      text,
  updated_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  motif     text;
  telephone text;
begin
  if not public.is_org_member(org_id) then
    raise exception 'Droits insuffisants.' using errcode = '42501';
  end if;

  if coalesce(btrim(terme), '') = '' then
    return;
  end if;

  motif := '%' || btrim(terme) || '%';

  -- Si la saisie contient surtout des chiffres, on tente aussi le telephone.
  if btrim(terme) ~ '^[0-9+][0-9 ().-]{2,}$' then
    telephone := public.normalize_phone(terme, '32');
  end if;

  return query
    select 'contact'::text,
           c.id,
           coalesce(nullif(btrim(coalesce(c.full_name, '')), ''), c.company_name, c.phone, 'Contact'),
           nullif(concat_ws(' · ', c.company_name, c.city, c.phone), ''),
           case when c.is_provisional then 'provisoire' else 'contact' end,
           c.updated_at
    from public.contacts c
    where c.organization_id = org_id
      and (
        c.full_name    ilike motif
        or c.company_name ilike motif
        or c.city         ilike motif
        or c.address_line1 ilike motif
        or c.phone        ilike motif
        or (telephone is not null and c.phone_e164 like '%' || right(telephone, 8) || '%')
      )

    union all

    select 'lead'::text,
           l.id,
           l.title,
           nullif(concat_ws(' · ', ct.full_name, l.city), ''),
           l.status::text,
           l.updated_at
    from public.leads l
    left join public.contacts ct on ct.id = l.contact_id
    where l.organization_id = org_id
      and (
        l.title ilike motif
        or l.description ilike motif
        or l.city ilike motif
      )

    order by 6 desc
    limit limite;
end;
$$;

grant execute on function public.search_crm(uuid, text, int) to authenticated;

-- -----------------------------------------------------------------------------
-- Tableau de bord (section 30)
--
-- Une seule requete pour l accueil. La question a laquelle il repond est
-- « qu est-ce qui demande mon attention maintenant ? » : on ne renvoie donc que
-- des compteurs d action, pas des statistiques de vanite.
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_counts(org_id uuid)
returns table (
  urgent_leads    int,
  new_leads       int,
  overdue_tasks   int,
  tasks_today     int,
  open_leads      int,
  contacts_total  int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  fuseau text;
begin
  if not public.is_org_member(org_id) then
    raise exception 'Droits insuffisants.' using errcode = '42501';
  end if;

  -- Les dates s evaluent dans le fuseau de l entreprise : « aujourd hui » a
  -- Bruxelles n est pas « aujourd hui » en UTC pendant une partie de la journee.
  select o.timezone into fuseau from public.organizations o where o.id = org_id;
  fuseau := coalesce(fuseau, 'Europe/Brussels');

  return query
  select
    (select count(*)::int from public.leads l
      where l.organization_id = org_id
        and l.priority = 'URGENT'
        and l.status not in ('WON', 'LOST')),
    (select count(*)::int from public.leads l
      where l.organization_id = org_id and l.status = 'NEW'),
    (select count(*)::int from public.tasks t
      where t.organization_id = org_id
        and t.status = 'OPEN'
        and t.due_at is not null
        and t.due_at < now()),
    (select count(*)::int from public.tasks t
      where t.organization_id = org_id
        and t.status = 'OPEN'
        and t.due_at is not null
        and (t.due_at at time zone fuseau)::date = (now() at time zone fuseau)::date),
    (select count(*)::int from public.leads l
      where l.organization_id = org_id and l.status not in ('WON', 'LOST')),
    (select count(*)::int from public.contacts c
      where c.organization_id = org_id);
end;
$$;

grant execute on function public.dashboard_counts(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Contact par telephone (utilise par Sophie en Phase 4, section 11)
-- Expose des maintenant : la deduplication doit etre eprouvee avant que des
-- appels reels en dependent.
-- -----------------------------------------------------------------------------
create or replace function public.find_contact_by_phone(org_id uuid, numero text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  indicatif text;
  normalise text;
  trouve    uuid;
begin
  if not public.is_org_member(org_id) then
    raise exception 'Droits insuffisants.' using errcode = '42501';
  end if;

  select o.country_calling_code into indicatif
  from public.organizations o where o.id = org_id;

  normalise := public.normalize_phone(numero, coalesce(indicatif, '32'));
  if normalise is null then
    return null;
  end if;

  select c.id into trouve
  from public.contacts c
  where c.organization_id = org_id and c.phone_e164 = normalise
  limit 1;

  return trouve;
end;
$$;

grant execute on function public.find_contact_by_phone(uuid, text) to authenticated;
