-- =============================================================================
-- 0032 — Le meme nettoyage, pour les vues
--
-- La migration 0031 bouclait sur `pg_tables`, qui ne contient pas les vues.
-- `public.calendar_status` a donc conserve TRUNCATE, REFERENCES et TRIGGER
-- pour `authenticated`.
--
-- Le risque reel est nul : TRUNCATE sur une vue echoue a l execution. Mais un
-- droit que personne ne peut utiliser et que personne ne comprend est un droit
-- qu on retire — et surtout, le laisser rendrait faux le controle ajoute dans
-- la suite d isolation, qui ne fait pas la difference entre une table et une
-- vue. Un controle qui echoue pour une raison benigne finit par etre ignore,
-- et c est comme cela qu on rate le jour ou il echoue pour une vraie raison.
--
-- Les vues creees plus tard sont deja couvertes : `alter default privileges
-- ... on tables` s applique aux tables, aux vues et aux tables distantes.
-- =============================================================================

do $$
declare
  v record;
begin
  for v in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      -- v = vue, m = vue materialisee, f = table distante, p = table partitionnee.
      -- `pg_tables` ne renvoie que `r` et `p` : tout le reste etait hors de
      -- portee de la migration 0031.
      and c.relkind in ('v', 'm', 'f', 'p')
  loop
    execute format(
      'revoke truncate, references, trigger on public.%I from anon, authenticated',
      v.relname
    );
  end loop;
end
$$;
