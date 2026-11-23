-- =============================================================================
-- 0040 — Les droits de table sur les devis
--
-- CE QUI MANQUAIT
-- ---------------
-- La migration 0039 a cree `quotes` et `quote_lines`, pose leurs politiques
-- d isolation, et oublie les GRANT. Resultat : « permission denied for table
-- quotes » des la premiere creation de devis.
--
-- POURQUOI LES POLITIQUES NE SUFFISENT PAS
-- ----------------------------------------
-- Ce projet tient deux verrous separes (migration 0012) :
--
--   1. le GRANT dit si un role a le DROIT de toucher la table ;
--   2. la politique RLS dit QUELLES LIGNES il voit.
--
-- Sans GRANT, PostgreSQL refuse avant meme de regarder les politiques. Une
-- table peut donc avoir des politiques parfaites et rester inaccessible.
--
-- L inverse est le piege plus dangereux, et c est pour cela que les deux
-- verrous existent : une table avec un GRANT mais sans politique serait
-- entierement lisible par n importe quel client connecte.
--
-- POURQUOI `alter default privileges` N A PAS AIDE
-- -----------------------------------------------
-- La migration 0031 l a utilise pour RETIRER des droits aux nouvelles tables,
-- pas pour en accorder. Aucun droit n est donc accorde automatiquement : ce
-- projet les declare table par table, volontairement, pour qu une table
-- nouvelle soit fermee tant que personne ne s est pose la question.
--
-- CE QUI N EST PAS ACCORDE
-- ------------------------
-- `anon` ne recoit rien : un visiteur non connecte n a aucune raison de voir
-- un devis. Et ni TRUNCATE, ni REFERENCES, ni TRIGGER, conformement aux
-- migrations 0031 et 0032.
-- =============================================================================

grant select, insert, update, delete on public.quotes      to authenticated;
grant select, insert, update, delete on public.quote_lines to authenticated;

-- Les accorder ne doit pas reintroduire ce que 0031 avait retire.
revoke truncate, references, trigger on public.quotes      from anon, authenticated;
revoke truncate, references, trigger on public.quote_lines from anon, authenticated;

-- Verification : doit rendre 8 lignes (4 privileges x 2 tables), et aucune
-- ligne pour anon.
--
-- select grantee, table_name, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name in ('quotes', 'quote_lines')
--   and grantee in ('anon', 'authenticated')
-- order by grantee, table_name, privilege_type;
