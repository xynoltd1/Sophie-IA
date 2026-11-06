-- =============================================================================
-- 0037 — Les pages legales entrent dans le referencement, fermees
--
-- Elles sont accessibles : le pied de page y mene, et une page legale
-- introuvable est une faute en soi. Mais elles sont semees NON indexables et
-- HORS du plan du site.
--
-- La raison n est pas technique. Ce sont des brouillons. Des conditions
-- generales de vente trouvees dans Google sont lues comme les conditions en
-- vigueur, et un client pourrait raisonnablement s en prevaloir. Les laisser
-- indexer reviendrait a publier un engagement que personne n a relu.
--
-- Le jour ou un juriste les valide, deux cases a cocher dans la console
-- suffisent : le reglage par page existe depuis la 0.19.0. Aucune migration
-- n est necessaire pour les ouvrir.
-- =============================================================================

insert into public.seo_pages (path, title, description, indexable, in_sitemap, published, priority)
values
  ('/mentions-legales', null,
   'Mentions legales. Document de travail, non valide juridiquement.',
   false, false, true, 0.2),
  ('/confidentialite', null,
   'Politique de confidentialite. Document de travail, non valide juridiquement.',
   false, false, true, 0.3),
  ('/cgu', null,
   'Conditions generales d utilisation. Document de travail, non valide juridiquement.',
   false, false, true, 0.2),
  ('/cgv', null,
   'Conditions generales de vente. Document de travail, non valide juridiquement.',
   false, false, true, 0.2),
  ('/cookies', null,
   'Cookies et mesure d audience. Aucun cookie de mesure n est depose.',
   false, false, true, 0.2)
on conflict (path) do nothing;
