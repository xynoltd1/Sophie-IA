-- =============================================================================
-- 0020 — Les fonctions metier doivent accepter le serveur
--
-- LE BUG
-- ------
-- `is_org_member()` repond a la question « l utilisateur connecte est-il membre
-- de cette organisation ? » en lisant `auth.uid()`. C est exactement ce qu il
-- faut pour une requete venue du navigateur.
--
-- Mais nos outils vocaux ne viennent pas d un navigateur. Pendant un appel
-- telephonique, il n y a AUCUN utilisateur connecte : c est notre serveur qui
-- agit, avec la cle service_role, apres avoir verifie la signature du
-- fournisseur de voix. Dans ce contexte, `auth.uid()` est nul,
-- `is_org_member()` renvoie faux, et toute fonction protegee par cette garde
-- leve « Droits insuffisants ».
--
-- Consequence concrete : `check_availability` appelle `available_slots()`, qui
-- refuse. Sophie repond au client « impossible de consulter l agenda » alors
-- que l agenda est parfaitement accessible. Le meme probleme touche
-- `appointments_for_day()`, `calendar_sync_state()` et
-- `find_contact_by_phone()`.
--
-- Cette erreur appartient a la meme famille que les deux precedentes (ADR-024,
-- ADR-025) : un chemin qui ne s execute QUE lorsqu un service externe appelle,
-- et qu aucun typecheck, lint, test ou build ne pouvait atteindre.
--
-- POURQUOI CETTE CORRECTION EST SURE
-- ----------------------------------
-- `is_org_member()` est utilisee a deux endroits :
--
--   1. dans les policies RLS, evaluees pour le role `authenticated` ;
--   2. comme garde a l interieur de fonctions SECURITY DEFINER.
--
-- Le role `service_role` NE PASSE PAS par les policies RLS : Postgres les
-- ignore pour lui. L usage (1) est donc inchange — aucune ligne nouvelle n est
-- exposee a un utilisateur connecte.
--
-- Pour l usage (2), accorder l acces au serveur n ouvre rien non plus :
-- service_role a deja un acces direct et complet aux tables sous-jacentes. La
-- garde ne le protegeait de rien ; elle l empechait seulement de passer par les
-- fonctions metier, c est-a-dire par le chemin le plus sur.
--
-- Ce qui protege reellement l organisation sur ce chemin n est pas cette garde,
-- mais la verification de signature du webhook et le fait que
-- l `organizationId` soit lu dans une configuration que NOUS avons ecrite,
-- jamais dans ce que le modele raconte (voir /api/voice/tools).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Detection du contexte serveur
--
-- On lit le role porte par le jeton, et non `current_user` : dans une fonction
-- SECURITY DEFINER, `current_user` vaut le proprietaire de la fonction, ce qui
-- rendrait le test toujours faux.
--
-- Hors PostgREST — par exemple dans l editeur SQL — `request.jwt.claims` est
-- absent et la fonction renvoie faux. C est le comportement voulu : une
-- requete manuelle n est pas « le serveur ».
-- -----------------------------------------------------------------------------
create or replace function public.is_server_context()
returns boolean
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) = 'service_role';
$$;

comment on function public.is_server_context() is
  'Vrai quand la requete porte la cle service_role, c est-a-dire quand elle vient de notre propre serveur et non d un navigateur. Voir migration 0020.';

grant execute on function public.is_server_context() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- is_org_member accepte desormais le serveur
--
-- La signature ne change pas : toutes les policies et toutes les fonctions qui
-- l appellent deja en beneficient sans etre reecrites. C est precisement
-- pourquoi la correction se fait ici plutot que dans chaque fonction : une
-- correction repetee quatre fois est une correction qu on oubliera la
-- cinquieme fois.
-- -----------------------------------------------------------------------------
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_server_context()
    or exists (
      select 1
      from public.organization_members m
      where m.organization_id = org_id
        and m.user_id = (select auth.uid())
        and m.status  = 'ACTIVE'
    );
$$;

comment on function public.is_org_member(uuid) is
  'Membre actif de l organisation, OU notre propre serveur (service_role). Le serveur a de toute facon un acces direct aux tables : lui refuser les fonctions metier ne protegeait rien et cassait les outils vocaux. Voir migration 0020.';

-- -----------------------------------------------------------------------------
-- org_role reste strictement personnel
--
-- Volontairement NON modifiee. Un role est un attribut d une personne ; le
-- serveur n en a pas. Les fonctions qui exigent un role precis (OWNER, ADMIN)
-- doivent continuer a refuser le serveur, sans quoi une action reservee au
-- proprietaire deviendrait declenchable par n importe quel chemin serveur.
-- -----------------------------------------------------------------------------
