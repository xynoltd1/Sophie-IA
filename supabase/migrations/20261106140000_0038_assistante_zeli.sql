-- =============================================================================
-- 0038 — L assistante par defaut s appelle Zeli
--
-- LA DECISION
-- -----------
-- Zelicall est la plateforme. Zeli est l assistante. Les deux noms etaient
-- confondus sous « Sophie IA », ce qui empechait de parler de l une sans
-- parler de l autre.
--
-- LE PROBLEME QUE CETTE MIGRATION DOIT RESOUDRE
-- ---------------------------------------------
-- Changer la valeur par defaut ne suffit pas : il faut renommer les comptes
-- qui portent « Sophie » PARCE QUE c etait le defaut, sans toucher a ceux qui
-- ont choisi ce nom. Or la base ne distinguait pas les deux : une colonne
-- texte ne dit pas si sa valeur a ete tapee ou heritee.
--
-- LE SIGNAL RETENU
-- ----------------
-- `greeting_updated_at`, pose par la migration 0036 a chaque enregistrement
-- depuis l ecran d accueil. Non nul = quelqu un a ouvert cet ecran et
-- enregistre ; le nom affiche a ce moment-la a donc ete vu et conserve
-- volontairement. Nul = personne n a jamais touche a ce reglage.
--
-- CE QUE CE SIGNAL NE PEUT PAS SAVOIR
-- -----------------------------------
-- Une entreprise qui aurait tape « Sophie » pendant l onboarding, avant que
-- l ecran d accueil n existe, est indiscernable d un defaut herite : elle
-- sera renommee. Le cas est possible, et aucune donnee en base ne permet de
-- le distinguer aujourd hui. La colonne ajoutee ici empeche qu il se
-- reproduise : a partir de maintenant, tout nom enregistre depuis un
-- formulaire est marque CUSTOM et ne sera plus jamais ecrase.
-- =============================================================================

alter table public.sophie_configurations
  add column if not exists assistant_name_source text not null default 'DEFAULT';

alter table public.sophie_configurations
  drop constraint if exists sophie_assistant_name_source_connue;
alter table public.sophie_configurations
  add constraint sophie_assistant_name_source_connue check (
    assistant_name_source in ('DEFAULT', 'CUSTOM')
  );

comment on column public.sophie_configurations.assistant_name_source is
  'DEFAULT = le nom vient du produit et peut etre renomme par une migration. CUSTOM = l entreprise l a choisi ; aucune migration ne doit l ecraser.';

-- 1. Marquer comme choisis les noms qui le sont manifestement.
update public.sophie_configurations
set assistant_name_source = 'CUSTOM'
where assistant_name_source = 'DEFAULT'
  and (
    -- Un nom qui n a jamais ete un defaut du produit.
    btrim(assistant_name) not in ('Sophie', 'Zeli')
    -- Ou un passage volontaire par l ecran d accueil.
    or greeting_updated_at is not null
  );

-- 2. Renommer, et seulement ce qui est herite.
update public.sophie_configurations
set assistant_name = 'Zeli'
where assistant_name_source = 'DEFAULT'
  and btrim(assistant_name) = 'Sophie';

-- 3. Le defaut, pour les comptes a venir.
alter table public.sophie_configurations
  alter column assistant_name set default 'Zeli';

-- 4. Le repli de la resolution d appel. Il servait quand aucune ligne de
--    configuration n existe : un compte sans reglage entendait « Sophie ».
create or replace function public.sophie_runtime_for_number(numero text)
returns table (
  organization_id        uuid,
  phone_number_id        uuid,
  is_test                boolean,
  assistant_external_id  text,
  organization_name      text,
  country_code           text,
  locale                 text,
  timezone               text,
  organization_active    boolean,
  assistant_name         text,
  spoken_name            text,
  language               text,
  voice_id               text,
  style                  text,
  greeting               text,
  greeting_morning       text,
  greeting_evening       text,
  greeting_closed        text,
  notice_position        text,
  behavior_notes         text,
  sophie_active          boolean,
  answer_mode            text,
  transfer_number_e164   text,
  profession_label       text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    n.organization_id,
    n.id,
    n.is_test,
    n.assistant_external_id,
    o.name,
    o.country_code,
    o.locale,
    o.timezone,
    (o.deleted_at is null),
    coalesce(c.assistant_name, 'Zeli'),
    c.spoken_name,
    coalesce(c.language, o.locale),
    c.voice_id,
    coalesce(c.style::text, 'CHALEUREUX'),
    c.greeting,
    c.greeting_morning,
    c.greeting_evening,
    c.greeting_closed,
    coalesce(c.notice_position, 'APRES_ACCUEIL'),
    c.behavior_notes,
    coalesce(c.is_active, false),
    coalesce(c.answer_mode::text, 'OFF'),
    c.transfer_number_e164,
    coalesce(t.label, b.custom_profession_label)
  from public.phone_numbers n
  join public.organizations o on o.id = n.organization_id
  left join public.sophie_configurations c on c.organization_id = n.organization_id
  left join public.business_profiles b on b.organization_id = n.organization_id
  left join public.profession_templates t on t.id = b.profession_template_id
  where n.e164 = public.normalize_phone(numero)
    and n.is_active
  limit 1;
$$;

revoke all on function public.sophie_runtime_for_number(text) from public, anon, authenticated;

-- Les tables, colonnes et fonctions gardent « sophie » dans leur nom. Les
-- renommer casserait les requetes, les types generes et l historique des
-- migrations, pour un gain que personne ne voit : ces noms ne sortent jamais
-- de la base.
