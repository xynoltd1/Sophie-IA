-- =============================================================================
-- 0024 — Le stockage des enregistrements (Phase 5, section 13 et 40)
--
-- L audio est une exigence majeure du cahier des charges, et la plus sensible
-- du produit : c est la voix d un client, enregistree chez un artisan.
--
-- Trois regles gouvernent ce qui suit.
--
-- **Le bucket est prive.** Aucune URL publique permanente, jamais. L acces
-- passe par une adresse signee, generee cote serveur apres verification de
-- l organisation.
--
-- **Le chemin est choisi par le serveur.** Il derive de l organisation et de
-- l appel. Le navigateur ne propose jamais un chemin : il demande un appel par
-- son identifiant, et le serveur decide ou se trouve le fichier.
--
-- **Ce que le fournisseur detient n est pas ce que nous conservons.** Le
-- fournisseur de telephonie enregistre de son cote, selon ses propres regles.
-- `recording_allowed()` ne gouverne que NOTRE conservation.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Le bucket
--
-- `public = false` : c est la seule ligne de ce fichier qui protege reellement
-- les enregistrements. Aucune policy n est creee sur storage.objects, et c est
-- deliberé : seul le serveur, avec la cle de service, lit et ecrit ici. Un
-- navigateur ne doit meme pas pouvoir tenter.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'call-recordings',
  'call-recordings',
  false,
  -- 100 Mo : un appel d une heure en MP3 pese quelques dizaines de Mo. La borne
  -- existe pour qu une reponse inattendue du fournisseur ne remplisse pas le
  -- stockage.
  104857600,
  array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Les metadonnees du fichier conserve (section 40)
-- -----------------------------------------------------------------------------
alter table public.calls
  add column if not exists recording_bytes        int,
  add column if not exists recording_content_type text,
  -- D ou vient le fichier, pour pouvoir le redemander tant que l adresse du
  -- fournisseur est valable. Les adresses signees du fournisseur expirent
  -- (`presignedUrlsExpiresAt`) : passe ce delai, un echec de rapatriement n est
  -- plus rattrapable, et il faut le savoir plutot que de reessayer en vain.
  add column if not exists recording_source_url   text,
  add column if not exists recording_error        text;

comment on column public.calls.recording_source_url is
  'Adresse du fichier chez le fournisseur. Temporaire : elle expire. Sert a reessayer un rapatriement recent, jamais a servir l audio au navigateur.';
comment on column public.calls.recording_error is
  'Pourquoi le dernier rapatriement a echoue. Affiche tel quel au professionnel : un echec muet est pire qu un echec explique.';

-- -----------------------------------------------------------------------------
-- Purge des enregistrements arrives a echeance
--
-- Supprime la ligne de stockage ET les references portees par l appel. L appel
-- lui-meme survit : sa transcription et son resume ne sont pas concernes par la
-- retention audio (ADR-013).
--
-- La suppression du fichier dans le bucket est faite par le serveur, qui lit
-- cette liste : SQL ne peut pas supprimer un objet de stockage de maniere
-- fiable depuis une fonction.
-- -----------------------------------------------------------------------------
create or replace function public.expired_recordings(limite int default 200)
returns table (call_id uuid, organization_id uuid, recording_path text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.organization_id, c.recording_path
  from public.calls c
  where c.recording_path is not null
    and c.recording_expires_at is not null
    and c.recording_expires_at < now()
  order by c.recording_expires_at
  limit greatest(1, least(limite, 1000));
$$;

revoke all on function public.expired_recordings(int) from public, anon, authenticated;

comment on function public.expired_recordings(int) is
  'Enregistrements arrives a echeance, a supprimer du bucket par le serveur. Reservee au serveur.';
