-- =============================================================================
-- 0031 — Retirer aux utilisateurs connectes le droit de vider une table
--
-- CE QUI A ETE TROUVE
--
-- Sur la base de production, le role `authenticated` possedait le droit
-- TRUNCATE sur les trente-quatre tables du schema public. Y compris `calls`,
-- `contacts`, `appointments` et `audit_logs`.
--
-- D ou cela vient : a la creation du projet, Supabase pose des privileges par
-- defaut sur le schema public. L un d eux accorde `Dxtm` a `authenticated` sur
-- toute table creee ensuite par le role postgres — c est-a-dire sur toutes
-- celles de nos migrations. Le `D` est TRUNCATE.
--
-- POURQUOI C EST GRAVE, ET POURQUOI CE N EST PAS UNE URGENCE
--
-- TRUNCATE ignore la securite au niveau ligne. Aucune policy ne l arrete :
-- RLS filtre des lignes, TRUNCATE supprime la table entiere sans les lire.
-- C est le seul droit du catalogue qui passe au travers de toute notre
-- architecture d isolation.
--
-- En pratique, il n est pas atteignable aujourd hui : l API REST de Supabase
-- n expose pas TRUNCATE, et un client du navigateur ne parle jamais a Postgres
-- directement. Il faudrait une fonction SQL `security invoker` qui le fasse,
-- et nous n en avons aucune.
--
-- C est donc un droit que personne n utilise, que rien ne justifie, et qui
-- deviendrait exploitable le jour ou quelqu un ecrirait la mauvaise fonction.
-- On le retire.
--
-- CE QUE CETTE MIGRATION NE PEUT PAS FAIRE
--
-- Elle s execute comme `postgres`. Elle corrige donc les privileges par defaut
-- poses par `postgres`, pas ceux poses par `supabase_admin`. Les tables creees
-- par nos migrations le sont par `postgres` : elles sont couvertes. Une table
-- creee un jour depuis l interface Supabase par un autre role ne le serait
-- pas — d ou le controle ajoute dans la suite d isolation, qui relit les
-- droits reels plutot que de faire confiance a cette migration.
-- =============================================================================

-- 1. Les tables qui existent deja.
do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    -- REFERENCES et TRIGGER partent avec : un utilisateur connecte n a aucune
    -- raison de poser une cle etrangere ou un declencheur sur nos tables.
    -- MAINTAIN n est pas retire : il n existe pas sur toutes les versions de
    -- Postgres, et il ne permet que VACUUM et ANALYZE.
    execute format(
      'revoke truncate, references, trigger on public.%I from anon, authenticated',
      t.tablename
    );
  end loop;
end
$$;

-- 2. Les tables a venir.
alter default privileges in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

-- 3. Tant qu a faire : ni anon ni authenticated n ont besoin de toucher aux
--    sequences. Les identifiants sont generes par la base, jamais par le
--    client.
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;

do $$
declare
  s record;
begin
  for s in
    select sequencename from pg_sequences where schemaname = 'public'
  loop
    execute format('revoke all on sequence public.%I from anon, authenticated', s.sequencename);
  end loop;
end
$$;
