-- =============================================================================
-- 0039 — Les devis (phase 9.1)
--
-- CE QUE CETTE MIGRATION FAIT
-- ---------------------------
-- Un devis, ses lignes, sa numerotation par entreprise et par annee, et le
-- calcul de ses totaux.
--
-- CE QU ELLE NE FERA JAMAIS
-- -------------------------
-- Des factures. Depuis le 1er janvier 2026, une entreprise assujettie a la TVA
-- etablie en Belgique doit emettre des factures electroniques STRUCTUREES pour
-- ses operations entre professionnels : reseau Peppol, format structure,
-- numerotation opposable, archivage de dix ans. Un devis n engage que
-- commercialement. La difference de charge entre les deux est ce qui rend l un
-- raisonnable ici et l autre non (ADR-055).
--
-- L ARGENT EST EN CENTIMES ENTIERS
-- --------------------------------
-- Jamais en nombre a virgule. 0,1 + 0,2 ne fait pas 0,3 en virgule flottante,
-- et un devis dont le total differe d un centime de la somme de ses lignes est
-- un devis que le client conteste.
--
-- LA TVA EST PAR LIGNE
-- --------------------
-- En Belgique, un meme chantier mele couramment 6 % (renovation d un logement
-- de plus de dix ans) et 21 % (le reste). Un taux unique par devis obligerait
-- l artisan a en faire deux.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Le prix d un service, pour les devis SEULEMENT
--
-- `services.price_indication` est volontairement du texte libre (« a partir de
-- 80 EUR », « sur devis ») : Zeli ne doit qu enoncer ce que l entreprise a
-- ecrit, jamais calculer (section 9 du cahier des charges).
--
-- Un devis, lui, a besoin d un nombre. Cette colonne le porte, et AUCUN outil
-- vocal ne la lit : elle sert a pre-remplir une ligne que l artisan voit et
-- corrige avant d envoyer. La regle de la section 9 reste donc entiere.
-- -----------------------------------------------------------------------------
alter table public.services
  add column if not exists quote_unit_price_cents int
    check (quote_unit_price_cents is null or quote_unit_price_cents between 0 and 100000000),
  add column if not exists quote_vat_rate numeric(5,2)
    check (quote_vat_rate is null or quote_vat_rate between 0 and 100);

comment on column public.services.quote_unit_price_cents is
  'Prix unitaire en centimes, utilise UNIQUEMENT pour pre-remplir une ligne de devis. Aucun outil vocal ne lit cette colonne : Zeli n enonce que price_indication.';

-- -----------------------------------------------------------------------------
-- Les etats d un devis
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'quote_status') then
    create type public.quote_status as enum (
      'BROUILLON',  -- en cours d ecriture, modifiable
      'ENVOYE',     -- parti chez le client : les lignes se figent
      'ACCEPTE',
      'REFUSE',
      'EXPIRE'      -- la date de validite est passee sans reponse
    );
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- quotes
-- -----------------------------------------------------------------------------
create table if not exists public.quotes (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,

  -- D ou vient le devis. Les trois sont facultatifs : un artisan peut en
  -- creer un sans appel prealable.
  contact_id       uuid references public.contacts (id) on delete set null,
  lead_id          uuid references public.leads (id) on delete set null,
  call_id          uuid references public.calls (id) on delete set null,

  -- Numerotation par entreprise et par annee. Nulle tant que le devis est un
  -- brouillon : un numero attribue puis abandonne laisserait un trou.
  year             int,
  sequence         int,
  reference        text,

  status           public.quote_status not null default 'BROUILLON',

  title            text not null check (length(btrim(title)) between 2 and 200),
  -- Copie de l identite du client au moment de l envoi. Si le contact change
  -- d adresse ensuite, le devis envoye doit continuer de dire ce qu il disait.
  customer_name    text,
  customer_address text,

  notes            text,
  terms            text,

  currency         text not null default 'EUR' check (currency in ('EUR')),

  -- Totaux recalcules par le serveur a chaque ecriture de ligne. Stockes et
  -- non calcules a la lecture : une liste de cent devis ne doit pas declencher
  -- cent sommes, et un devis envoye doit garder SES totaux meme si un taux de
  -- TVA change l an prochain.
  total_excl_cents int not null default 0 check (total_excl_cents >= 0),
  total_vat_cents  int not null default 0 check (total_vat_cents >= 0),
  total_incl_cents int not null default 0 check (total_incl_cents >= 0),

  valid_until      date,
  sent_at          timestamptz,
  decided_at       timestamptz,
  decline_reason   text,

  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Un numero existe des que le devis est sorti du brouillon, et jamais avant.
  constraint quotes_reference_coherente check (
    (status = 'BROUILLON') = (reference is null)
  ),
  -- Une decision porte une date.
  constraint quotes_decision_coherente check (
    (status in ('ACCEPTE', 'REFUSE')) = (decided_at is not null)
  ),
  constraint quotes_envoi_coherent check (
    (status = 'BROUILLON') or (sent_at is not null)
  )
);

-- Deux devis ne peuvent pas porter le meme numero dans la meme entreprise la
-- meme annee. La contrainte est la derniere ligne de defense : la fonction
-- d attribution verrouille deja, mais une insertion directe passerait a cote.
create unique index if not exists quotes_numero_unique
  on public.quotes (organization_id, year, sequence)
  where sequence is not null;

create index if not exists quotes_org_statut_idx
  on public.quotes (organization_id, status, created_at desc);
create index if not exists quotes_contact_idx
  on public.quotes (contact_id) where contact_id is not null;
create index if not exists quotes_lead_idx
  on public.quotes (lead_id) where lead_id is not null;
create index if not exists quotes_call_idx
  on public.quotes (call_id) where call_id is not null;
-- Pour la tache qui fait expirer les devis echus.
create index if not exists quotes_echeance_idx
  on public.quotes (valid_until)
  where status = 'ENVOYE' and valid_until is not null;

-- -----------------------------------------------------------------------------
-- quote_lines
-- -----------------------------------------------------------------------------
create table if not exists public.quote_lines (
  id              uuid primary key default gen_random_uuid(),
  quote_id        uuid not null references public.quotes (id) on delete cascade,
  -- Redondant avec quotes.organization_id, et c est voulu : la politique RLS
  -- de cette table peut alors trancher sans jointure, et une ligne ne peut pas
  -- se retrouver rattachee a un devis d une autre entreprise.
  organization_id uuid not null references public.organizations (id) on delete cascade,

  -- Le service d origine, pour la tracabilite. Le libelle est copie : si le
  -- service est renomme, le devis envoye garde ses mots.
  service_id      uuid references public.services (id) on delete set null,

  label           text not null check (length(btrim(label)) between 1 and 200),
  description     text,

  -- Quantite au centieme : 1,5 heure, 12,25 metres.
  quantity        numeric(10,2) not null default 1 check (quantity > 0 and quantity <= 100000),
  unit            text check (unit is null or length(btrim(unit)) between 1 and 20),
  unit_price_cents int not null check (unit_price_cents between 0 and 100000000),
  vat_rate        numeric(5,2) not null default 21 check (vat_rate between 0 and 100),

  sort_order      int not null default 100,
  created_at      timestamptz not null default now()
);

create index if not exists quote_lines_devis_idx
  on public.quote_lines (quote_id, sort_order);

-- -----------------------------------------------------------------------------
-- Les totaux — calcules ici, jamais recus du navigateur
--
-- Un total envoye par le client est un total qu il choisit. Le serveur refait
-- la somme a chaque ecriture de ligne, par declencheur : meme une requete
-- directe en base ne peut pas laisser un devis incoherent derriere elle.
--
-- L arrondi se fait PAR LIGNE, comme le veut l usage comptable : arrondir
-- seulement a la fin fait diverger le total de la somme des lignes affichees,
-- et c est exactement ce qu un client releve.
-- -----------------------------------------------------------------------------
create or replace function public.recompute_quote_totals(devis uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  hors_tva bigint := 0;
  tva      bigint := 0;
begin
  select
    coalesce(sum(round(l.quantity * l.unit_price_cents)), 0),
    coalesce(sum(round(round(l.quantity * l.unit_price_cents) * l.vat_rate / 100)), 0)
  into hors_tva, tva
  from public.quote_lines l
  where l.quote_id = devis;

  update public.quotes q
  set total_excl_cents = hors_tva,
      total_vat_cents  = tva,
      total_incl_cents = hors_tva + tva,
      updated_at       = now()
  where q.id = devis;
end;
$$;

revoke all on function public.recompute_quote_totals(uuid) from public, anon, authenticated;

create or replace function public.quote_lines_touch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.recompute_quote_totals(coalesce(new.quote_id, old.quote_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists quote_lines_totaux on public.quote_lines;
create trigger quote_lines_totaux
  after insert or update or delete on public.quote_lines
  for each row execute function public.quote_lines_touch();

-- -----------------------------------------------------------------------------
-- Un devis envoye ne se modifie plus en silence
--
-- Le client a recu un document. Si ses lignes changent apres coup, l entreprise
-- detient une version et le client une autre, sans que rien ne le signale.
-- Pour changer un devis envoye, il faut le refuser et en faire un nouveau.
-- -----------------------------------------------------------------------------
create or replace function public.quote_lines_figees()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  etat public.quote_status;
begin
  select status into etat
  from public.quotes
  where id = coalesce(new.quote_id, old.quote_id);

  if etat is distinct from 'BROUILLON' then
    raise exception 'Ce devis a ete envoye : ses lignes ne peuvent plus changer. Creez-en un nouveau.'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists quote_lines_verrou on public.quote_lines;
create trigger quote_lines_verrou
  before insert or update or delete on public.quote_lines
  for each row execute function public.quote_lines_figees();

-- -----------------------------------------------------------------------------
-- La numerotation
--
-- Appelee au moment de l envoi, jamais a la creation : un brouillon abandonne
-- laisserait un trou dans la serie.
--
-- Le verrou consultatif porte sur le couple entreprise/annee. Deux envois
-- simultanes dans la meme entreprise attendent l un apres l autre ; deux
-- entreprises differentes ne se genent pas.
-- -----------------------------------------------------------------------------
create or replace function public.assign_quote_reference(devis uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org        uuid;
  annee      int := extract(year from now())::int;
  prochain   int;
  numero     text;
  etat       public.quote_status;
begin
  select organization_id, status into org, etat
  from public.quotes where id = devis;

  if org is null then
    raise exception 'Devis introuvable.';
  end if;

  if etat is distinct from 'BROUILLON' then
    raise exception 'Ce devis porte deja un numero.';
  end if;

  perform pg_advisory_xact_lock(hashtext(org::text || annee::text));

  select coalesce(max(sequence), 0) + 1 into prochain
  from public.quotes
  where organization_id = org and year = annee;

  numero := 'D' || annee || '-' || lpad(prochain::text, 4, '0');

  update public.quotes
  set year = annee, sequence = prochain, reference = numero
  where id = devis;

  return numero;
end;
$$;

revoke all on function public.assign_quote_reference(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Isolation
-- -----------------------------------------------------------------------------
alter table public.quotes      enable row level security;
alter table public.quote_lines enable row level security;

drop policy if exists "devis: lecture par les membres" on public.quotes;
create policy "devis: lecture par les membres"
  on public.quotes for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "devis: ecriture par les membres" on public.quotes;
create policy "devis: ecriture par les membres"
  on public.quotes for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "lignes de devis: lecture par les membres" on public.quote_lines;
create policy "lignes de devis: lecture par les membres"
  on public.quote_lines for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "lignes de devis: ecriture par les membres" on public.quote_lines;
create policy "lignes de devis: ecriture par les membres"
  on public.quote_lines for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- Le deuxieme verrou, independant de RLS (migrations 0031 et 0032).
revoke truncate, references, trigger on public.quotes      from anon, authenticated;
revoke truncate, references, trigger on public.quote_lines from anon, authenticated;

comment on table public.quotes is
  'Devis. PAS de factures : voir ADR-055 et la facturation electronique structuree obligatoire en Belgique depuis le 1er janvier 2026.';
