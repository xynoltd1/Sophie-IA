-- =============================================================================
-- 0001 — Extensions et fonctions utilitaires
-- Phase 0 — fondations
-- =============================================================================

create extension if not exists "pgcrypto"   with schema extensions;  -- gen_random_uuid()
create extension if not exists "citext"     with schema extensions;  -- emails / slugs insensibles a la casse
create extension if not exists "btree_gist" with schema extensions;  -- contraintes d'exclusion (anti double-reservation, Phase 3)

-- -----------------------------------------------------------------------------
-- Horodatage automatique
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger BEFORE UPDATE : maintient la colonne updated_at.';

-- -----------------------------------------------------------------------------
-- Normalisation de numero de telephone (E.164 approximatif)
-- Utilise pour la deduplication des contacts (Phase 2) et l identification des
-- appelants (Phase 4). Volontairement simple et deterministe cote base ; la
-- normalisation fine (libphonenumber) reste faite cote application.
-- -----------------------------------------------------------------------------
create or replace function public.normalize_phone(raw text, default_country_code text default '32')
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  if raw is null or btrim(raw) = '' then
    return null;
  end if;

  -- On conserve un eventuel '+' initial, on supprime tout le reste.
  digits := regexp_replace(raw, '[^0-9+]', '', 'g');

  if left(digits, 1) = '+' then
    return '+' || regexp_replace(substr(digits, 2), '[^0-9]', '', 'g');
  end if;

  digits := regexp_replace(digits, '[^0-9]', '', 'g');

  if digits = '' then
    return null;
  end if;

  -- 0032... -> +32...
  if left(digits, 2) = '00' then
    return '+' || substr(digits, 3);
  end if;

  -- 0470... -> +32470...
  if left(digits, 1) = '0' then
    return '+' || default_country_code || substr(digits, 2);
  end if;

  return '+' || digits;
end;
$$;

comment on function public.normalize_phone(text, text) is
  'Normalisation E.164 approximative. Le pays par defaut vient de organizations.country_calling_code.';

-- unaccent n est pas toujours disponible selon la configuration du projet
-- Supabase : on fournit un repli deterministe pour les caracteres latins.
create or replace function public.unaccent_fallback(value text)
returns text
language sql
immutable
as $$
  select translate(
    value,
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
    'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'
  );
$$;

-- -----------------------------------------------------------------------------
-- Generation de slug d organisation
-- -----------------------------------------------------------------------------
create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '-' from
      regexp_replace(
        regexp_replace(lower(unaccent_fallback(value)), '[^a-z0-9]+', '-', 'g'),
        '-{2,}', '-', 'g'
      )
    ),
    ''
  );
$$;
