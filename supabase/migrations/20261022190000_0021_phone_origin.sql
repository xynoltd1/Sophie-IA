-- =============================================================================
-- 0021 — D ou vient le numero d un contact
--
-- Tous les numeros ne se valent pas, et le produit faisait comme si.
--
-- Un numero venu du RESEAU telephonique est certain : il est transmis par
-- l operateur, il ne passe par aucune oreille ni aucun micro.
--
-- Un numero DICTE par l appelant traverse la reconnaissance vocale. L incident
-- du 2026-10-22 l a montre : « zero quatre, sept deux, douze, trente-quatre »
-- est devenu `04 72 12 34`, un numero trop court pour exister. Il a ete
-- enregistre sans que rien ne le signale.
--
-- Meme repete et confirme, un numero dicte reste moins sur qu un numero du
-- reseau. L artisan doit voir la difference AVANT de rappeler : composer un
-- mauvais numero lui fait perdre du temps, et derange quelqu un qui n a rien
-- demande.
--
-- Consequence de regle, appliquee dans le code : un numero dicte n ecrase
-- jamais un numero venu du reseau.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'phone_origin') then
    create type public.phone_origin as enum (
      'NETWORK',   -- transmis par l operateur : certain
      'DICTATED',  -- dicte pendant l appel : a verifier
      'MANUAL'     -- saisi par un membre de l equipe
    );
  end if;
end
$$;

alter table public.contacts
  add column if not exists phone_origin public.phone_origin;

comment on column public.contacts.phone_origin is
  'Provenance du numero. NETWORK est certain, DICTATED a verifier avant de rappeler. Un numero dicte n ecrase jamais un numero reseau (migration 0021).';

-- Les contacts existants ont ete crees a la main ou importes : aucun ne vient
-- d une dictee. On ne devine pas pour autant ceux qui viennent du reseau.
update public.contacts
   set phone_origin = 'MANUAL'
 where phone_origin is null
   and phone is not null;
