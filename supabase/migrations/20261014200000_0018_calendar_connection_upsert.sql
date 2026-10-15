-- =============================================================================
-- 0018 — Rendre la contrainte d unicite de calendar_connections utilisable par
--        ON CONFLICT
--
-- Le probleme
-- -----------
-- La migration 0016 garantissait l unicite par un index sur EXPRESSION :
--
--   create unique index calendar_connections_unique_idx
--     on calendar_connections (
--       organization_id,
--       coalesce(member_id, '000...'::uuid),
--       provider
--     );
--
-- Le coalesce etait la pour une bonne raison : en SQL, deux NULL ne sont pas
-- egaux, donc un index unique ordinaire aurait laisse passer plusieurs
-- connexions « sans intervenant designe » pour une meme organisation.
--
-- Mais PostgreSQL ne peut deduire un index que si l expression fournie a
-- ON CONFLICT correspond EXACTEMENT a celle de l index. Le code applicatif
-- ecrivait `on conflict (organization_id, member_id, provider)` — trois noms de
-- colonnes nus — et PostgreSQL repondait :
--
--   there is no unique or exclusion constraint matching the ON CONFLICT
--   specification
--
-- Consequence reelle : la connexion d un agenda Google echouait a la toute
-- derniere etape. Google avait accepte, les jetons etaient en main, et
-- l enregistrement etait rejete. L utilisateur voyait « La connexion a echoue ».
--
-- La correction
-- -------------
-- `nulls not distinct` (PostgreSQL 15+) donne exactement la semantique voulue —
-- deux NULL comptent comme egaux — tout en gardant un index sur de simples
-- colonnes, donc deductible par ON CONFLICT.
--
-- Ce qui change pour la suite : une contrainte d unicite destinee a un upsert
-- doit porter sur des colonnes, jamais sur une expression. Si une expression est
-- indispensable, le code doit lire puis ecrire, pas faire d upsert.
-- =============================================================================

do $$
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception
      'PostgreSQL 15 ou superieur est requis (nulls not distinct). Version detectee : %',
      current_setting('server_version');
  end if;
end
$$;

drop index if exists public.calendar_connections_unique_idx;

create unique index if not exists calendar_connections_unique_idx
  on public.calendar_connections (organization_id, member_id, provider)
  nulls not distinct;

comment on index public.calendar_connections_unique_idx is
  'Une seule connexion par organisation, intervenant et fournisseur. Index sur colonnes simples, et non sur expression, pour rester deductible par ON CONFLICT (voir ADR-025).';
