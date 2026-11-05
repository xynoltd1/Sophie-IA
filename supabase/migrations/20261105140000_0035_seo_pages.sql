-- =============================================================================
-- 0035 — Referencement page par page, et images publiques
--
-- La migration 0034 a rendu reglables les metadonnees globales du site. Celle-ci
-- descend d un cran : chaque page publique peut avoir son titre, sa description
-- et sa propre decision d indexation.
--
-- UN GARDE-FOU EST INSCRIT DANS LA TABLE
--
-- `path` est contraint : il doit commencer par `/` et ne peut pas commencer par
-- l un des prefixes prives. Autrement dit, il est impossible de creer depuis
-- l ecran une entree qui ferait indexer `/app` ou `/admin` — pas meme par
-- erreur de frappe, pas meme en appelant l API directement.
--
-- Le faire en base plutot que dans le formulaire est deliberé : un controle
-- applicatif protege le formulaire, une contrainte protege la table.
-- =============================================================================

create table if not exists public.seo_pages (
  id           uuid primary key default gen_random_uuid(),
  path         text not null unique,
  title        text,
  description  text,
  og_image     text,
  -- Faux : la page porte un noindex. Vrai : elle peut etre indexee, a
  -- condition que l environnement le permette aussi. Les deux conditions,
  -- jamais une seule.
  indexable    boolean not null default true,
  in_sitemap   boolean not null default true,
  published    boolean not null default true,
  priority     numeric(2,1) not null default 0.5 check (priority between 0.0 and 1.0),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) on delete set null,

  constraint seo_pages_chemin_public check (
    path like '/%'
    and path not like '/app%'
    and path not like '/admin%'
    and path not like '/api%'
    and path not like '/auth%'
    and path not like '/onboarding%'
    and path not like '/rdv%'
    and path not like '/invitation%'
    and path not like '/nouveau-mot-de-passe%'
  )
);

create index if not exists seo_pages_sitemap_idx
  on public.seo_pages (in_sitemap, published) where in_sitemap and published;

alter table public.seo_pages enable row level security;

drop policy if exists "pages seo: lecture plateforme" on public.seo_pages;
create policy "pages seo: lecture plateforme"
  on public.seo_pages for select to authenticated
  using (public.is_platform_admin());

grant select on public.seo_pages to authenticated;

comment on table public.seo_pages is
  'Referencement page par page. La contrainte sur `path` rend impossible de declarer une page privee, meme en appelant l API directement.';

comment on constraint seo_pages_chemin_public on public.seo_pages is
  'Un controle applicatif protege le formulaire ; cette contrainte protege la table.';

-- Les deux pages publiques d aujourd hui, pour que l ecran ne soit pas vide.
insert into public.seo_pages (path, title, description, in_sitemap, priority) values
  ('/', null, null, true, 1.0),
  ('/signup', 'Creer mon compte — Sophie IA',
   'Creez votre compte Sophie IA : dites ce que vous faites, connectez votre agenda, et laissez-la repondre pendant que vous travaillez.',
   true, 0.6)
on conflict (path) do nothing;

revoke truncate, references, trigger on public.seo_pages from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Images publiques
--
-- L image de partage doit etre lisible sans authentification : WhatsApp et
-- LinkedIn la demandent sans jamais se connecter. C est donc le seul bucket
-- public du projet, et il ne doit contenir que cela.
--
-- Le bucket des enregistrements reste prive (migration 0024). Les deux ne se
-- ressemblent pas et ne doivent jamais etre confondus : l un contient des
-- visuels, l autre la voix de clients.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-assets',
  'public-assets',
  true,
  2 * 1024 * 1024,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;
