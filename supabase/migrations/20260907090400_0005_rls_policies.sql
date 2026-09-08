-- =============================================================================
-- 0005 — Row Level Security
-- Phase 0 — sections 4 et 41
--
-- Regle du projet : toute table portant un organization_id a RLS ACTIVE et une
-- policy par operation. Une nouvelle table sans policy est une fuite de donnees.
-- Le test tests/multi-tenant-isolation.test.ts verifie qu aucune table publique
-- n echappe a cette regle.
-- =============================================================================

alter table public.profiles                 enable row level security;
alter table public.organizations            enable row level security;
alter table public.organization_members     enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.activities               enable row level security;
alter table public.audit_logs               enable row level security;

-- On force RLS meme pour le proprietaire des tables : seule la cle service_role
-- (qui contourne RLS par conception) peut ecrire hors policy.
alter table public.audit_logs force row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- Chacun lit et modifie son propre profil. On ne peut pas s auto-promouvoir
-- administrateur de la plateforme.
-- -----------------------------------------------------------------------------
create policy "profiles: lire son profil"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: lire les profils de ses collegues"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1
      from public.organization_members mine
      join public.organization_members theirs
        on theirs.organization_id = mine.organization_id
      where mine.user_id  = (select auth.uid())
        and mine.status   = 'ACTIVE'
        and theirs.user_id = public.profiles.id
        and theirs.status  = 'ACTIVE'
    )
  );

create policy "profiles: modifier son profil"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and is_platform_admin = (
      select p.is_platform_admin from public.profiles p where p.id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- organizations
-- Lecture reservee aux membres actifs. Creation via public.create_organization()
-- uniquement : aucune policy INSERT n est ouverte.
-- -----------------------------------------------------------------------------
create policy "organizations: lire son organisation"
  on public.organizations for select to authenticated
  using (deleted_at is null and public.is_org_member(id));

create policy "organizations: modifier — OWNER et ADMIN"
  on public.organizations for update to authenticated
  using (deleted_at is null and public.has_org_role(id, array['OWNER', 'ADMIN']::public.member_role[]))
  with check (public.has_org_role(id, array['OWNER', 'ADMIN']::public.member_role[]));

-- Pas de policy DELETE : la suppression se fait par deleted_at, cote serveur,
-- avec journalisation (section 35).

-- -----------------------------------------------------------------------------
-- organization_members
-- -----------------------------------------------------------------------------
create policy "membres: lire l equipe"
  on public.organization_members for select to authenticated
  using (public.is_org_member(organization_id));

create policy "membres: ajouter — OWNER et ADMIN"
  on public.organization_members for insert to authenticated
  with check (public.has_org_role(organization_id, array['OWNER', 'ADMIN']::public.member_role[]));

create policy "membres: modifier — OWNER et ADMIN"
  on public.organization_members for update to authenticated
  using (public.has_org_role(organization_id, array['OWNER', 'ADMIN']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['OWNER', 'ADMIN']::public.member_role[]));

create policy "membres: retirer — OWNER"
  on public.organization_members for delete to authenticated
  using (public.has_org_role(organization_id, array['OWNER']::public.member_role[]));

-- -----------------------------------------------------------------------------
-- organization_invitations
-- Le jeton en clair n est jamais lisible : seul token_hash est stocke.
-- -----------------------------------------------------------------------------
create policy "invitations: lire — OWNER et ADMIN"
  on public.organization_invitations for select to authenticated
  using (public.has_org_role(organization_id, array['OWNER', 'ADMIN']::public.member_role[]));

create policy "invitations: creer — OWNER et ADMIN"
  on public.organization_invitations for insert to authenticated
  with check (public.has_org_role(organization_id, array['OWNER', 'ADMIN']::public.member_role[]));

create policy "invitations: revoquer — OWNER et ADMIN"
  on public.organization_invitations for update to authenticated
  using (public.has_org_role(organization_id, array['OWNER', 'ADMIN']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['OWNER', 'ADMIN']::public.member_role[]));

-- -----------------------------------------------------------------------------
-- activities
-- Lecture par les membres. Ecriture uniquement cote serveur : les activites
-- doivent refleter des faits, pas des affirmations du client.
-- -----------------------------------------------------------------------------
create policy "activites: lire"
  on public.activities for select to authenticated
  using (public.is_org_member(organization_id));

-- -----------------------------------------------------------------------------
-- audit_logs
-- Aucune policy pour authenticated : acces exclusivement service_role.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Revocation des droits par defaut sur les futurs objets.
-- Sans cela, une table creee plus tard serait lisible par anon/authenticated
-- avant meme d avoir une policy.
-- -----------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon;
