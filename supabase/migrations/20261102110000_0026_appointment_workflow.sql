-- =============================================================================
-- 0026 — Workflow complet du rendez-vous (Phase 6, sections 22 a 26 et 34)
--
-- Ce que cette migration rend possible, et qui manquait :
--
--   - refuser un rendez-vous en disant pourquoi, et prevenir le client ;
--   - proposer un autre horaire et attendre la reponse du CLIENT, qui n a pas
--     de compte dans l application ;
--   - annuler en prevenant ;
--   - envoyer ces messages de maniere fiable, avec reprise sur echec ;
--   - alerter le professionnel sans le noyer.
--
-- Trois principes.
--
-- **Un message est une entite, pas un effet de bord.** `outbound_messages` est
-- une file : on sait ce qui est parti, ce qui a echoue et pourquoi. Section 26 :
-- « SMS non envoye — Reessayer » exige de conserver le message, pas seulement
-- de le tenter.
--
-- **Un echec d envoi n annule jamais le rendez-vous.** Les deux sont separes
-- exprès.
--
-- **Le client decide sans compte.** La proposition d un nouvel horaire se joue
-- sur un lien a usage limite, avec un jeton imprevisible et une expiration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- outbound_messages — la file des messages sortants
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'message_channel') then
    create type public.message_channel as enum ('SMS', 'WHATSAPP', 'EMAIL');
  end if;

  if not exists (select 1 from pg_type where typname = 'message_status') then
    create type public.message_status as enum (
      'QUEUED',     -- a envoyer
      'SENDING',    -- tentative en cours
      'SENT',       -- accepte par l operateur
      'DELIVERED',  -- accuse de reception recu
      'FAILED'      -- echoue ; reessayable tant que attempts < plafond
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'message_kind') then
    create type public.message_kind as enum (
      'APPOINTMENT_CONFIRMED',
      'APPOINTMENT_CHANGE_PROPOSED',
      'APPOINTMENT_REJECTED',
      'APPOINTMENT_CANCELLED',
      'APPOINTMENT_REMINDER',
      'CUSTOM'
    );
  end if;
end
$$;

create table if not exists public.outbound_messages (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,

  contact_id          uuid references public.contacts (id) on delete set null,
  appointment_id      uuid references public.appointments (id) on delete set null,

  channel             public.message_channel not null default 'SMS',
  kind                public.message_kind not null default 'CUSTOM',

  to_e164             text not null check (to_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  body                text not null check (length(btrim(body)) between 1 and 1600),

  status              public.message_status not null default 'QUEUED',
  attempts            int not null default 0,
  last_error          text,

  provider            text,
  provider_message_id text,

  -- Cle d idempotence metier : « la confirmation du rendez-vous X ». Deux
  -- clics sur le meme bouton, ou un webhook rejoue, ne doivent pas envoyer
  -- deux SMS au client. Un doublon coute de l argent et fait desordre.
  idempotency_key     text not null,

  created_by          uuid references auth.users (id) on delete set null,
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists outbound_messages_idempotency_idx
  on public.outbound_messages (organization_id, idempotency_key);
create index if not exists outbound_messages_queue_idx
  on public.outbound_messages (status, created_at) where status in ('QUEUED', 'FAILED');
create index if not exists outbound_messages_org_idx
  on public.outbound_messages (organization_id, created_at desc);
create index if not exists outbound_messages_contact_idx
  on public.outbound_messages (contact_id, created_at desc) where contact_id is not null;

drop trigger if exists outbound_messages_set_updated_at on public.outbound_messages;
create trigger outbound_messages_set_updated_at
  before update on public.outbound_messages
  for each row execute function public.set_updated_at();

comment on table public.outbound_messages is
  'File des messages sortants. Un echec d envoi n annule jamais le rendez-vous associe (section 26).';

-- -----------------------------------------------------------------------------
-- notifications — ce qui demande l attention du professionnel (section 34)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_category') then
    create type public.notification_category as enum (
      'CRITIQUE',  -- urgence : interrompt
      'ACTION',    -- une decision est attendue
      'INFO'       -- pour information
    );
  end if;
end
$$;

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  -- Null = toute l entreprise. Une notification destinee a une personne
  -- precise porte son identifiant.
  user_id         uuid references auth.users (id) on delete cascade,

  category        public.notification_category not null default 'INFO',
  title           text not null check (length(btrim(title)) between 2 and 200),
  body            text,

  -- Vers quoi elle pointe. Section 34 : une notification qui ne mene nulle
  -- part oblige a chercher, donc elle ne sert a rien.
  href            text,
  subject_type    text,
  subject_id      uuid,

  -- Deux notifications identiques pour le meme sujet ne doivent pas
  -- s empiler : c est ainsi qu on apprend a ignorer les notifications.
  dedupe_key      text,

  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create unique index if not exists notifications_dedupe_idx
  on public.notifications (organization_id, dedupe_key)
  where dedupe_key is not null and read_at is null;
create index if not exists notifications_org_unread_idx
  on public.notifications (organization_id, created_at desc) where read_at is null;

comment on table public.notifications is
  'Alertes du professionnel (section 34). Chacune pointe vers la ressource concernee.';

-- -----------------------------------------------------------------------------
-- La proposition d un autre horaire (section 23)
--
-- Le client n a pas de compte. Il repond par un lien contenant un jeton
-- imprevisible, valable quelques jours. Le jeton ne donne acces qu a CE
-- rendez-vous, et seulement pour accepter ou refuser.
-- -----------------------------------------------------------------------------
alter table public.appointments
  add column if not exists proposed_starts_at  timestamptz,
  add column if not exists proposed_ends_at    timestamptz,
  add column if not exists proposal_token      text,
  add column if not exists proposal_expires_at timestamptz,
  add column if not exists decision_reason     text,
  add column if not exists external_synced_at  timestamptz,
  add column if not exists external_sync_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'appointments_proposal_coherent'
  ) then
    alter table public.appointments
      add constraint appointments_proposal_coherent check (
        proposed_starts_at is null
        or (proposed_ends_at is not null and proposed_ends_at > proposed_starts_at)
      );
  end if;
end
$$;

create unique index if not exists appointments_proposal_token_idx
  on public.appointments (proposal_token) where proposal_token is not null;

comment on column public.appointments.proposal_token is
  'Jeton du lien envoye au client pour accepter ou refuser un nouvel horaire. Imprevisible, a duree limitee, propre a ce rendez-vous.';

-- -----------------------------------------------------------------------------
-- Lire une proposition depuis son jeton, sans compte
--
-- SECURITY DEFINER et portee minimale : on renvoie ce qu il faut pour afficher
-- la page, rien de plus. Pas de telephone, pas d adresse, pas de notes. Le
-- jeton ne doit jamais devenir une fuite de fiche client.
-- -----------------------------------------------------------------------------
create or replace function public.proposal_by_token(jeton text)
returns table (
  appointment_id    uuid,
  organization_name text,
  title             text,
  current_starts_at timestamptz,
  proposed_starts_at timestamptz,
  proposed_ends_at  timestamptz,
  status            public.appointment_status,
  expires_at        timestamptz,
  timezone          text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id,
         o.name,
         a.title,
         a.starts_at,
         a.proposed_starts_at,
         a.proposed_ends_at,
         a.status,
         a.proposal_expires_at,
         o.timezone
  from public.appointments a
  join public.organizations o on o.id = a.organization_id
  where a.proposal_token = jeton
    and a.proposal_token is not null
  limit 1;
$$;

-- Le client n est pas authentifie : la fonction doit etre appelable par le
-- role anonyme. C est voulu, et c est pour cela qu elle ne renvoie presque rien.
grant execute on function public.proposal_by_token(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Reponse du client a la proposition
--
-- Accepter deplace le rendez-vous sur le creneau propose et le confirme. La
-- contrainte d exclusion s applique : si le creneau a ete pris entre-temps, la
-- fonction echoue et le client voit un message honnete.
--
-- Refuser remet le rendez-vous en attente de decision du professionnel : ce
-- n est pas au client d annuler ce que le professionnel a propose.
-- -----------------------------------------------------------------------------
create or replace function public.respond_to_proposal(jeton text, accepte boolean)
returns table (resultat text, appointment_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rdv record;
begin
  select a.* into rdv
  from public.appointments a
  where a.proposal_token = jeton and a.proposal_token is not null
  limit 1;

  if rdv is null then
    return query select 'INTROUVABLE'::text, null::uuid;
    return;
  end if;

  if rdv.status <> 'CHANGE_PROPOSED' then
    return query select 'DEJA_TRAITE'::text, rdv.id;
    return;
  end if;

  if rdv.proposal_expires_at is not null and rdv.proposal_expires_at < now() then
    return query select 'EXPIRE'::text, rdv.id;
    return;
  end if;

  if not accepte then
    update public.appointments a
    set status = 'PENDING_APPROVAL',
        proposed_starts_at = null,
        proposed_ends_at = null,
        proposal_token = null,
        proposal_expires_at = null
    where a.id = rdv.id;

    insert into public.activities (organization_id, actor_kind, type, subject_type, subject_id, summary)
    values (rdv.organization_id, 'CUSTOMER', 'PROPOSAL_DECLINED', 'appointment', rdv.id,
            'Le client a refuse le nouvel horaire propose.');

    insert into public.notifications (organization_id, category, title, body, href, subject_type, subject_id, dedupe_key)
    values (rdv.organization_id, 'ACTION', 'Nouvel horaire refuse',
            'Le client n a pas accepte l horaire propose. Le rendez-vous attend votre decision.',
            '/app/agenda', 'appointment', rdv.id, 'proposal-declined-' || rdv.id::text);

    return query select 'REFUSE'::text, rdv.id;
    return;
  end if;

  begin
    update public.appointments a
    set starts_at = rdv.proposed_starts_at,
        ends_at = rdv.proposed_ends_at,
        status = 'CONFIRMED',
        proposed_starts_at = null,
        proposed_ends_at = null,
        proposal_token = null,
        proposal_expires_at = null,
        external_synced_at = null
    where a.id = rdv.id;
  exception
    when exclusion_violation then
      return query select 'CRENEAU_PRIS'::text, rdv.id;
      return;
  end;

  insert into public.activities (organization_id, actor_kind, type, subject_type, subject_id, summary)
  values (rdv.organization_id, 'CUSTOMER', 'PROPOSAL_ACCEPTED', 'appointment', rdv.id,
          'Le client a accepte le nouvel horaire.');

  insert into public.notifications (organization_id, category, title, body, href, subject_type, subject_id, dedupe_key)
  values (rdv.organization_id, 'INFO', 'Nouvel horaire accepte',
          'Le client a accepte. Le rendez-vous est confirme et doit etre ecrit dans votre agenda.',
          '/app/agenda', 'appointment', rdv.id, 'proposal-accepted-' || rdv.id::text);

  return query select 'ACCEPTE'::text, rdv.id;
end;
$$;

grant execute on function public.respond_to_proposal(text, boolean) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- RLS et privileges
-- -----------------------------------------------------------------------------
alter table public.outbound_messages enable row level security;
alter table public.notifications     enable row level security;

drop policy if exists "messages: lecture par les membres" on public.outbound_messages;
create policy "messages: lecture par les membres"
  on public.outbound_messages for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "notifications: lecture par les membres" on public.notifications;
create policy "notifications: lecture par les membres"
  on public.notifications for select to authenticated
  using (public.is_org_member(organization_id) and (user_id is null or user_id = (select auth.uid())));

-- Marquer comme lue est la seule ecriture permise depuis le navigateur.
drop policy if exists "notifications: marquer comme lue" on public.notifications;
create policy "notifications: marquer comme lue"
  on public.notifications for update to authenticated
  using (public.is_org_member(organization_id) and (user_id is null or user_id = (select auth.uid())))
  with check (public.is_org_member(organization_id));

grant select         on public.outbound_messages to authenticated;
grant select, update on public.notifications     to authenticated;

-- -----------------------------------------------------------------------------
-- Les messages a envoyer, pour le travail planifie
-- -----------------------------------------------------------------------------
create or replace function public.messages_to_send(plafond_tentatives int default 3, limite int default 25)
returns table (message_id uuid, organization_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.organization_id
  from public.outbound_messages m
  where m.status in ('QUEUED', 'FAILED')
    and m.attempts < greatest(0, plafond_tentatives)
  order by m.created_at
  limit greatest(1, least(limite, 100));
$$;

revoke all on function public.messages_to_send(int, int) from public, anon, authenticated;
