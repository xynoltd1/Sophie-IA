-- =============================================================================
-- 0022 — Le lien direct appel -> lead / rendez-vous / tache
--
-- Pourquoi cette migration existe.
--
-- Jusqu ici, la fiche appel retrouvait « le rendez-vous issu de cet appel » par
-- deduction : meme contact, cree apres le debut de l appel. Cette heuristique
-- marche tant qu un contact n appelle qu une fois par jour. Elle se trompe des
-- que le meme client rappelle, et elle ne permet pas de repondre a la question
-- que l artisan se pose vraiment :
--
--   « Ce client a appele. Est-ce que quelque chose en est sorti ? »
--
-- Un appel ou Sophie n a rien enregistre — le client a raccroche, n a pas
-- explique son probleme, n a pas pris de rendez-vous — n apparait aujourd hui
-- nulle part ailleurs que dans l onglet Appels. Personne ne rappelle ce client.
-- C est un client perdu sans que le produit le signale, et c est exactement ce
-- que la section 30 interdit : l accueil doit repondre a « qu est-ce qui
-- demande mon attention maintenant ? ».
--
-- Trois colonnes suffisent a rendre le lien exact, et le reste en decoule.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Les colonnes de rattachement
--
-- `on delete set null` et non `cascade` : supprimer un appel (retention audio,
-- section 42) ne doit jamais supprimer le rendez-vous qui en est issu. Le
-- rendez-vous existe independamment de la trace de l appel.
-- -----------------------------------------------------------------------------
alter table public.leads
  add column if not exists call_id uuid references public.calls (id) on delete set null;

alter table public.appointments
  add column if not exists call_id uuid references public.calls (id) on delete set null;

alter table public.tasks
  add column if not exists call_id uuid references public.calls (id) on delete set null;

comment on column public.leads.call_id is
  'Appel dont ce lead est issu, lorsqu il vient de Sophie. Null pour une saisie manuelle.';
comment on column public.appointments.call_id is
  'Appel dont ce rendez-vous est issu. Null pour un rendez-vous saisi a la main.';
comment on column public.tasks.call_id is
  'Appel dont cette tache est issue. Null pour une tache saisie a la main.';

-- Index partiels : la majorite des lignes auront call_id a null, et seules les
-- lignes rattachees sont interrogees.
create index if not exists leads_call_idx
  on public.leads (call_id) where call_id is not null;
create index if not exists appointments_call_idx
  on public.appointments (call_id) where call_id is not null;
create index if not exists tasks_call_idx
  on public.tasks (call_id) where call_id is not null;

-- -----------------------------------------------------------------------------
-- Reprise de l historique
--
-- Sans cette reprise, tous les appels deja passes apparaitraient comme « sans
-- suite » des le deploiement, y compris ceux qui ont reellement produit un
-- rendez-vous. On applique une derniere fois l ancienne heuristique — meme
-- contact, cree apres le debut de l appel, dans les deux heures — pour
-- rattraper le passe, puis on ne s en sert plus jamais.
--
-- Deux heures : une ecriture de Sophie a lieu PENDANT l appel. Au-dela, le lien
-- n est plus credible, et un lien faux est pire qu un lien absent.
-- -----------------------------------------------------------------------------
update public.leads l
set call_id = c.id
from public.calls c
where l.call_id is null
  and l.source = 'SOPHIE'
  and c.organization_id = l.organization_id
  and c.contact_id = l.contact_id
  and l.created_at >= c.started_at
  and l.created_at <= c.started_at + interval '2 hours';

update public.appointments a
set call_id = c.id
from public.calls c
where a.call_id is null
  and c.organization_id = a.organization_id
  and c.contact_id = a.contact_id
  and a.created_at >= c.started_at
  and a.created_at <= c.started_at + interval '2 hours';

update public.tasks t
set call_id = c.id
from public.calls c
where t.call_id is null
  and t.source = 'SOPHIE'
  and c.organization_id = t.organization_id
  and c.contact_id = t.contact_id
  and t.created_at >= c.started_at
  and t.created_at <= c.started_at + interval '2 hours';

-- -----------------------------------------------------------------------------
-- dashboard_counts — deux compteurs de plus
--
-- Le type de retour change, donc `create or replace` ne suffit pas : il faut
-- supprimer puis recreer. Aucune vue ni contrainte n en depend.
-- -----------------------------------------------------------------------------
drop function if exists public.dashboard_counts(uuid);

create function public.dashboard_counts(org_id uuid)
returns table (
  urgent_leads       int,
  new_leads          int,
  overdue_tasks      int,
  tasks_today        int,
  open_leads         int,
  contacts_total     int,
  pending_appointments int,
  calls_no_followup  int,
  calls_failed       int
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
      where c.organization_id = org_id),

    -- Rendez-vous a valider (sections 22 et 30).
    --
    -- Ils manquaient a l accueil : un rendez-vous provisoire pour la semaine
    -- prochaine n apparaissait que dans l agenda, alors que c est la decision
    -- la plus urgente que Sophie puisse produire. Les rendez-vous passes sont
    -- comptes eux aussi : un creneau provisoire qu on a laisse filer demande
    -- encore une decision, ne serait-ce que pour le refuser.
    (select count(*)::int from public.appointments a
      where a.organization_id = org_id
        and a.status = 'PENDING_APPROVAL'),

    -- Appels sans suite : la conversation a eu lieu, et rien n en est sorti.
    --
    -- Trois filtres, et chacun evite un faux signal :
    --   - `is_test` : un appel d essai ne doit rien reclamer (section 45) ;
    --   - 15 secondes : en dessous, c est un faux numero ou un raccrochage
    --     immediat, pas un client a rappeler ;
    --   - 7 jours : passe ce delai, rappeler ne sert plus a rien, et une liste
    --     qui ne se vide jamais finit par etre ignoree.
    --
    -- Une duree inconnue n est PAS traitee comme une duree courte : un appel
    -- termine dont le fournisseur n a pas rendu la duree est une anomalie, et
    -- la cacher reviendrait a perdre le client en silence.
    (select count(*)::int from public.calls c
      where c.organization_id = org_id
        and c.status = 'COMPLETED'
        and c.is_test = false
        and (c.duration_seconds is null or c.duration_seconds >= 15)
        and c.started_at > now() - interval '7 days'
        and not exists (select 1 from public.leads        x where x.call_id = c.id)
        and not exists (select 1 from public.appointments x where x.call_id = c.id)
        and not exists (select 1 from public.tasks        x where x.call_id = c.id)),

    -- Appels echoues : Sophie n a pas pu repondre. L artisan doit le savoir,
    -- parce que c est un client qui a entendu une sonnerie dans le vide.
    (select count(*)::int from public.calls c
      where c.organization_id = org_id
        and c.status in ('FAILED', 'MISSED')
        and c.is_test = false
        and c.started_at > now() - interval '7 days');
end;
$$;

grant execute on function public.dashboard_counts(uuid) to authenticated;

comment on function public.dashboard_counts(uuid) is
  'Compteurs d action de l accueil (section 30). Ne renvoie que ce qui demande une decision, jamais des statistiques de vanite.';
