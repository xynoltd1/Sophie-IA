-- =============================================================================
-- 0042 — Numeroter et sortir du brouillon : un seul mouvement
--
-- ## Ce qui ne marchait pas
--
-- La table porte cette regle, et elle est juste :
--
--   (status = 'BROUILLON') = (reference is null)
--
-- Un brouillon n a pas de numero ; un devis numerote n est plus un brouillon.
--
-- Mais le travail se faisait en deux temps : la fonction ecrivait le numero en
-- laissant l etat a BROUILLON, puis le serveur changeait l etat. Chacune des
-- deux moities viole la regle a elle seule. La premiere echouait donc
-- toujours, et l artisan lisait « Le numero n a pas pu etre attribue » sur un
-- devis parfaitement complet.
--
-- Deux corrections empilees sur ce bouton : la 0041 rend le droit d executer
-- la fonction, celle-ci rend la fonction executable sans violer la table.
--
-- ## La correction
--
-- La fonction ecrit le numero ET l etat dans le meme UPDATE. C est d ailleurs
-- la verite du metier : attribuer un numero, c est figer le devis. Les deux ne
-- se separent pas.
--
-- Elle rend aussi la date de passage a l etat ENVOYE, pour que le serveur n ait
-- plus rien a ecrire derriere elle.
-- =============================================================================

create or replace function public.assign_quote_reference(devis uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org        uuid;
  annee      int := extract(year from now())::int;
  prochain   int;
  numero     text;
  etat       public.quote_status;
  total      int;
begin
  select organization_id, status, total_incl_cents
    into org, etat, total
  from public.quotes where id = devis;

  if org is null then
    raise exception 'Devis introuvable.';
  end if;

  if etat is distinct from 'BROUILLON' then
    raise exception 'Ce devis porte deja un numero.';
  end if;

  if coalesce(total, 0) <= 0 then
    raise exception 'Un devis sans ligne chiffree ne peut pas etre fige.';
  end if;

  -- Deux appels simultanes ne doivent pas prendre le meme numero. Le verrou
  -- porte sur l entreprise et l annee, le temps de la transaction.
  perform pg_advisory_xact_lock(hashtext(org::text || annee::text));

  select coalesce(max(sequence), 0) + 1 into prochain
  from public.quotes
  where organization_id = org and year = annee;

  numero := 'D' || annee || '-' || lpad(prochain::text, 4, '0');

  -- Le numero et l etat dans la meme ecriture : la contrainte
  -- quotes_reference_coherente interdit de les separer, et elle a raison.
  update public.quotes
  set year      = annee,
      sequence  = prochain,
      reference = numero,
      status    = 'ENVOYE',
      sent_at   = now()
  where id = devis;

  return numero;
end;
$$;

revoke all on function public.assign_quote_reference(uuid) from public, anon, authenticated;
grant execute on function public.assign_quote_reference(uuid) to service_role;

comment on function public.assign_quote_reference(uuid) is
  'Attribue le numero et fige le devis en une seule ecriture. Les deux ne se '
  'separent pas : la contrainte quotes_reference_coherente l interdit.';
