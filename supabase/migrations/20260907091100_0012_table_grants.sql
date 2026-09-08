-- =============================================================================
-- 0012 — Privileges de table
--
-- BUG CORRIGE ICI : les policies RLS existaient, mais les GRANT au niveau des
-- tables manquaient. Resultat : « permission denied for table organizations »
-- pour tout utilisateur connecte, y compris sur ses PROPRES donnees.
--
-- Postgres applique deux controles successifs :
--   1. le privilege sur la table (GRANT)   -> ai-je le droit de lire cette table ?
--   2. la policy RLS                        -> quelles lignes ai-je le droit de voir ?
--
-- Sans le premier, le second n est jamais atteint. Nous nous reposions sur les
-- privileges par defaut de Supabase, qui ne se sont pas appliques a nos tables.
-- On ne suppose plus : chaque privilege est declare explicitement.
--
-- Accorder SELECT a `authenticated` n ouvre AUCUNE donnee : RLS reste seul juge
-- des lignes visibles. C est le modele de securite normal de Supabase.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- anon (visiteur non connecte) : aucun acces a une table metier.
-- L inscription et la connexion passent par le schema auth, pas par ici.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;

-- -----------------------------------------------------------------------------
-- authenticated : les privileges correspondent exactement aux policies de 0005,
-- 0007, 0009, 0010 et 0011. Une operation sans policy n a pas de privilege.
-- -----------------------------------------------------------------------------

-- Identite : on lit son profil et celui de ses collegues, on modifie le sien.
grant select, update on public.profiles              to authenticated;

-- Organisation : lecture et mise a jour. Pas d INSERT — la creation passe
-- exclusivement par create_organization() (ADR-005). Pas de DELETE — la
-- suppression est logique et faite cote serveur.
grant select, update on public.organizations         to authenticated;

grant select, insert, update, delete on public.organization_members     to authenticated;
grant select, insert, update          on public.organization_invitations to authenticated;

-- Activites : lecture seule. Une activite doit refleter un fait, jamais une
-- affirmation venue du navigateur.
grant select on public.activities                    to authenticated;

-- audit_logs : AUCUN privilege, volontairement. Acces service_role uniquement.

grant select on public.audio_retention_events        to authenticated;

-- Annonces telephoniques : lecture par tous, ecriture filtree par la policy
-- « plateforme ». Le privilege seul n autorise rien.
grant select, insert, update, delete on public.recording_notice_templates to authenticated;
grant select, insert, update, delete on public.profession_templates       to authenticated;

-- Configuration metier : ecriture reservee a OWNER et ADMIN par les policies.
grant select, insert, update, delete on public.business_profiles      to authenticated;
grant select, insert, update, delete on public.services               to authenticated;
grant select, insert, update, delete on public.business_hours         to authenticated;
grant select, insert, update, delete on public.absences               to authenticated;
grant select, insert, update, delete on public.sophie_configurations  to authenticated;
grant select, insert, update, delete on public.business_knowledge     to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- -----------------------------------------------------------------------------
-- service_role : contourne RLS par conception. Reserve aux webhooks, aux
-- traitements asynchrones et a la console plateforme.
-- -----------------------------------------------------------------------------
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- -----------------------------------------------------------------------------
-- Tables futures : on fixe les privileges par defaut plutot que de compter sur
-- ceux du projet. C est la cause exacte du bug corrige ici.
--
-- Note : `authenticated` n est volontairement PAS dans cette liste. Chaque
-- nouvelle table doit declarer ses privileges en meme temps que ses policies,
-- ce qui force a se poser la question plutot qu a heriter d un acces.
-- -----------------------------------------------------------------------------
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public revoke all on tables from anon;
