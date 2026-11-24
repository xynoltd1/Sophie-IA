-- =============================================================================
-- 0041 — Le droit d executer les fonctions appelees par le serveur
--
-- ## Ce qui ne marchait pas
--
-- Quatorze fonctions appelees par le serveur ne pouvaient pas s executer.
--
-- PostgreSQL accorde par defaut le droit d execution a PUBLIC. Les migrations
-- de ce depot le retirent — « revoke all on function … from public, anon,
-- authenticated » — pour qu un navigateur ne puisse pas les appeler. Mais
-- retirer a PUBLIC retire a tout le monde, y compris au service role avec
-- lequel le serveur les appelle. Et rien ne le lui rendait.
--
-- Le premier symptome visible fut « Le numero n a pas pu etre attribue » sur un
-- devis complet. Les treize autres ne s etaient pas encore vues parce que ces
-- chemins n ont jamais tourne en reel — dont celui qui compte le plus :
--
--   sophie_runtime_for_number — la fonction qui, a l arrivee d un appel,
--   trouve l entreprise et l accueil a prononcer. Sans ce droit, Zeli ne peut
--   pas repondre au telephone. Pas « mal repondre » : pas repondre.
--
-- ## La regle
--
-- Retirer un droit n en accorde jamais un. Toute fonction appelee par le code
-- a besoin d un GRANT explicite, pour le role qui l appelle. Le service role
-- pour un appel serveur, `authenticated` pour un appel depuis l application.
--
-- Ce n est pas un relachement de securite : le service role est deja le role de
-- confiance du serveur, et sa cle ne quitte jamais l environnement serveur.
-- Les fonctions restent fermees a `anon` et a `authenticated`.
-- =============================================================================

-- Numerotation d un devis — decision du serveur, jamais du navigateur.
grant execute on function public.assign_quote_reference(uuid) to service_role;

-- Accueil telephonique : la fonction qui repond a l arrivee d un appel.
grant execute on function public.sophie_runtime_for_number(text) to service_role;
grant execute on function public.organization_for_number(text)   to service_role;

-- Traitement apres appel.
grant execute on function public.calls_awaiting_summary(integer, integer) to service_role;

-- Messages entrants et sortants.
grant execute on function public.receive_inbound_message(uuid, public.conversation_channel, text, text, text) to service_role;
grant execute on function public.messages_to_send(integer, integer) to service_role;

-- Retention : suppression des donnees arrivees a echeance.
grant execute on function public.expired_recordings(integer)        to service_role;
grant execute on function public.calls_to_purge(integer)            to service_role;
grant execute on function public.purge_expired_transcripts(integer) to service_role;
grant execute on function public.purge_expired_summaries(integer)   to service_role;
grant execute on function public.purge_expired_call_events()        to service_role;
grant execute on function public.purge_expired_messages(integer)    to service_role;
grant execute on function public.record_retention_run(text, integer, text, text) to service_role;

-- Verification des integrations depuis la console.
grant execute on function public.record_integration_check(text, text, text, text) to service_role;
