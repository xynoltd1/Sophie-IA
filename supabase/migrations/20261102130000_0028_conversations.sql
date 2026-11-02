-- =============================================================================
-- 0028 — Conversations omnicanales (Phase 6 et section 18)
--
-- L entite centrale demandee par le cahier des charges : une CONVERSATION,
-- portant un canal, et rattachee a un contact. Un appel, un SMS, un e-mail et
-- un formulaire web doivent pouvoir se lire dans un meme fil.
--
-- Ce que cette migration fait reellement :
--   - elle cree la structure pour tous les canaux ;
--   - elle rend SMS entrant et sortant pleinement fonctionnels ;
--   - elle laisse WhatsApp, e-mail et formulaire web prevus mais non branches.
--
-- Cette derniere phrase est la plus importante : l architecture est prete, les
-- adaptateurs ne le sont pas, et il ne faut pas faire croire l inverse.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'conversation_channel') then
    create type public.conversation_channel as enum (
      'PHONE', 'SMS', 'WHATSAPP', 'EMAIL', 'WEB_FORM'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'message_direction') then
    create type public.message_direction as enum ('INBOUND', 'OUTBOUND');
  end if;
end
$$;

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contact_id      uuid references public.contacts (id) on delete set null,

  channel         public.conversation_channel not null,
  subject         text,

  -- Une conversation ouverte attend une reponse du professionnel.
  is_open         boolean not null default true,
  last_message_at timestamptz not null default now(),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists conversations_org_recent_idx
  on public.conversations (organization_id, last_message_at desc);
create index if not exists conversations_contact_idx
  on public.conversations (contact_id, last_message_at desc) where contact_id is not null;

-- Un contact n a qu une conversation ouverte par canal : sinon chaque SMS
-- entrant creerait un fil, et l historique deviendrait illisible.
create unique index if not exists conversations_open_unique_idx
  on public.conversations (organization_id, contact_id, channel)
  where is_open and contact_id is not null;

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create table if not exists public.conversation_messages (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  conversation_id     uuid not null references public.conversations (id) on delete cascade,

  direction           public.message_direction not null,
  channel             public.conversation_channel not null,
  body                text not null check (length(btrim(body)) between 1 and 4000),

  -- Rattachements vers les objets qui portent deja l information complete.
  call_id             uuid references public.calls (id) on delete set null,
  outbound_message_id uuid references public.outbound_messages (id) on delete set null,

  -- Identifiant chez le fournisseur : cle de deduplication d un message
  -- entrant rejoue.
  provider_message_id text,

  occurred_at         timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index if not exists conversation_messages_fil_idx
  on public.conversation_messages (conversation_id, occurred_at);

create unique index if not exists conversation_messages_provider_idx
  on public.conversation_messages (organization_id, provider_message_id)
  where provider_message_id is not null;

comment on table public.conversation_messages is
  'Messages d une conversation, tous canaux. Les objets detailles (appel, message sortant) restent dans leurs tables ; ici on garde le fil.';

-- -----------------------------------------------------------------------------
-- Reception d un message entrant
--
-- Tout en une fois, en base : retrouver ou creer le contact, retrouver ou
-- ouvrir la conversation, ajouter le message, alerter. Le faire en plusieurs
-- allers-retours applicatifs laisserait des fils orphelins quand un webhook
-- est interrompu au milieu.
-- -----------------------------------------------------------------------------
create or replace function public.receive_inbound_message(
  org_id      uuid,
  canal       public.conversation_channel,
  numero      text,
  contenu     text,
  provider_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalise  text;
  contact    uuid;
  fil        uuid;
  message    uuid;
  indicatif  text;
begin
  if coalesce(btrim(contenu), '') = '' then
    return null;
  end if;

  -- Rejeu : le meme message du fournisseur ne doit pas creer un doublon.
  if provider_id is not null then
    select m.id into message
    from public.conversation_messages m
    where m.organization_id = org_id and m.provider_message_id = provider_id
    limit 1;

    if message is not null then
      return message;
    end if;
  end if;

  select o.country_calling_code into indicatif from public.organizations o where o.id = org_id;
  normalise := public.normalize_phone(numero, coalesce(indicatif, '32'));

  if normalise is not null then
    select c.id into contact
    from public.contacts c
    where c.organization_id = org_id and c.phone_e164 = normalise
    limit 1;

    if contact is null then
      insert into public.contacts (organization_id, phone, phone_e164, source, phone_origin)
      values (org_id, numero, normalise, 'SOPHIE', 'NETWORK')
      returning id into contact;
    end if;
  end if;

  select c.id into fil
  from public.conversations c
  where c.organization_id = org_id
    and c.channel = canal
    and c.is_open
    and c.contact_id is not distinct from contact
  limit 1;

  if fil is null then
    insert into public.conversations (organization_id, contact_id, channel, last_message_at)
    values (org_id, contact, canal, now())
    returning id into fil;
  else
    update public.conversations set last_message_at = now(), is_open = true where id = fil;
  end if;

  insert into public.conversation_messages
    (organization_id, conversation_id, direction, channel, body, provider_message_id)
  values (org_id, fil, 'INBOUND', canal, left(btrim(contenu), 4000), provider_id)
  returning id into message;

  insert into public.notifications
    (organization_id, category, title, body, href, subject_type, subject_id, dedupe_key)
  values (
    org_id, 'ACTION', 'Nouveau message reçu',
    left(btrim(contenu), 160),
    case when contact is not null then '/app/contacts/' || contact::text else '/app' end,
    'conversation', fil, 'conversation-' || fil::text
  )
  on conflict do nothing;

  return message;
end;
$$;

revoke all on function public.receive_inbound_message(uuid, public.conversation_channel, text, text, text)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.conversations         enable row level security;
alter table public.conversation_messages enable row level security;

drop policy if exists "conversations: lecture par les membres" on public.conversations;
create policy "conversations: lecture par les membres"
  on public.conversations for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "conversations: cloture par les membres" on public.conversations;
create policy "conversations: cloture par les membres"
  on public.conversations for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "messages de conversation: lecture par les membres" on public.conversation_messages;
create policy "messages de conversation: lecture par les membres"
  on public.conversation_messages for select to authenticated
  using (public.is_org_member(organization_id));

grant select, update on public.conversations         to authenticated;
grant select         on public.conversation_messages to authenticated;
