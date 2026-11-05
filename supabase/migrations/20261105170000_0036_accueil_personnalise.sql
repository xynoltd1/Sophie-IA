-- =============================================================================
-- 0036 — L accueil telephonique appartient a chaque entreprise
--
-- LE PROBLEME
-- -----------
-- Un seul assistant servait toutes les organisations, avec une premiere
-- phrase fixe. Un client qui appelait « Martin Plomberie » entendait le nom
-- du logiciel, pas celui de l entreprise qu il appelait.
--
-- CE QUE CETTE MIGRATION AJOUTE
-- -----------------------------
-- 1. Le nom tel qu il se PRONONCE, distinct de la raison sociale. On ne dit
--    pas « Martin Plomberie SRL » au telephone.
-- 2. Des formules d accueil par moment de la journee, facultatives.
-- 3. La place de l annonce legale : avant ou apres l accueil commercial.
-- 4. Une fonction qui rend, en UN aller-retour, tout ce dont le fournisseur
--    vocal a besoin pour decrocher. Il nous laisse 7,5 secondes : deux
--    requetes successives, c est deja un risque.
--
-- CE QUE CETTE MIGRATION NE TOUCHE PAS
-- ------------------------------------
-- `disclose_ai` reste verrouille a vrai (migration 0019). Aucun champ ajoute
-- ici ne permet de retirer la transparence sur la nature d IA : le texte est
-- libre, l obligation ne l est pas, et le code l impose au moment de parler.
-- =============================================================================

alter table public.sophie_configurations
  -- Le nom prononce. Nul = on dit le nom de l organisation.
  add column if not exists spoken_name text,
  -- Variantes facultatives. Nulles = la formule de base sert tout le temps.
  add column if not exists greeting_morning text,
  add column if not exists greeting_evening text,
  -- Hors horaires d ouverture. Nulle = la formule de base sert aussi la nuit.
  add column if not exists greeting_closed text,
  add column if not exists notice_position text not null default 'APRES_ACCUEIL',
  add column if not exists greeting_updated_at timestamptz;

alter table public.sophie_configurations
  drop constraint if exists sophie_spoken_name_longueur;
alter table public.sophie_configurations
  add constraint sophie_spoken_name_longueur check (
    spoken_name is null or length(btrim(spoken_name)) between 2 and 60
  );

-- 400 caracteres : au-dela, l appelant raccroche avant la fin. Ce n est pas
-- une limite technique, c est la duree au-dela de laquelle un accueil cesse
-- d en etre un.
do $$
declare col text;
begin
  foreach col in array array['greeting_morning','greeting_evening','greeting_closed']
  loop
    execute format(
      'alter table public.sophie_configurations drop constraint if exists sophie_%s_longueur',
      col);
    execute format(
      'alter table public.sophie_configurations add constraint sophie_%1$s_longueur
         check (%1$I is null or length(btrim(%1$I)) between 10 and 400)',
      col);
  end loop;
end
$$;

alter table public.sophie_configurations
  drop constraint if exists sophie_notice_position_connue;
alter table public.sophie_configurations
  add constraint sophie_notice_position_connue check (
    notice_position in ('APRES_ACCUEIL', 'AVANT_ACCUEIL')
  );

comment on column public.sophie_configurations.spoken_name is
  'Le nom tel qu il se prononce au telephone. Distinct de la raison sociale : on ne dit pas « SRL » a un client.';
comment on column public.sophie_configurations.notice_position is
  'Ou tombe l annonce legale. APRES_ACCUEIL garde un accueil naturel ; AVANT_ACCUEIL informe avant tout echange. Jamais « nulle part ».';

-- -----------------------------------------------------------------------------
-- sophie_runtime_for_number — tout ce qu il faut pour decrocher, en une fois
--
-- Le fournisseur vocal laisse 7,5 secondes entre sa demande et notre reponse,
-- delai non configurable, au-dela duquel l appel echoue. Chaque aller-retour
-- supplementaire vers la base est donc un risque pris sur un vrai client au
-- bout du fil.
--
-- La fonction ne rend JAMAIS de ligne quand le numero est inconnu ou inactif.
-- Pas de valeur par defaut, pas de repli sur une autre organisation : le
-- silence est la seule reponse correcte quand on ne sait pas au nom de qui on
-- parlerait.
-- -----------------------------------------------------------------------------
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
    coalesce(c.assistant_name, 'Sophie'),
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

comment on function public.sophie_runtime_for_number(text) is
  'Resout le numero APPELE en configuration d accueil complete, en un seul aller-retour. Reserve au serveur. Ne rend aucune ligne pour un numero inconnu ou inactif : jamais de repli sur une autre organisation.';
