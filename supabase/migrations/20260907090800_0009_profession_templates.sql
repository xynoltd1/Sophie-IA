-- =============================================================================
-- 0009 — Modeles de metier
-- Phase 1 — sections 6 et 7 du cahier des charges
--
-- Principe : Sophie n est jamais codee pour un metier. Un ProfessionTemplate
-- fournit des valeurs de depart que l entreprise surcharge ensuite. Ajouter
-- « vitrier » doit etre une insertion de donnees, jamais une modification du
-- coeur du produit.
-- =============================================================================

create table public.profession_templates (
  id                          uuid primary key default gen_random_uuid(),
  slug                        text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,48}$'),
  label                       text not null,
  locale                      text not null default 'fr',

  -- Un metier non publie reste invisible dans l onboarding.
  is_published                boolean not null default true,
  sort_order                  int not null default 100,

  -- Saisie libre du metier (cas « Autre »). Un seul modele porte ce drapeau.
  allows_custom_label         boolean not null default false,

  -- Valeurs de depart. JSONB parce que la forme evolue metier par metier et que
  -- ces donnees sont lues en bloc, jamais requetees champ par champ.
  suggested_services          jsonb not null default '[]'::jsonb,
  qualification_questions     jsonb not null default '[]'::jsonb,
  urgency_categories          jsonb not null default '[]'::jsonb,
  vocabulary                  jsonb not null default '{}'::jsonb,

  default_appointment_minutes int not null default 60 check (default_appointment_minutes between 5 and 1440),
  default_buffer_minutes      int not null default 15 check (default_buffer_minutes between 0 and 240),

  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

comment on table public.profession_templates is
  'Valeurs par defaut d un metier. Modifiable depuis la console plateforme sans deploiement (section 37).';
comment on column public.profession_templates.suggested_services is
  'Tableau [{name, duration_minutes, is_urgent, collect}]. Suggestions, jamais des tarifs.';

create index profession_templates_published_idx
  on public.profession_templates (sort_order, label) where is_published;

create trigger profession_templates_set_updated_at
  before update on public.profession_templates
  for each row execute function public.set_updated_at();

alter table public.profession_templates enable row level security;

create policy "metiers: lecture des metiers publies"
  on public.profession_templates for select to authenticated
  using (is_published or public.is_platform_admin());

create policy "metiers: ecriture plateforme"
  on public.profession_templates for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- Catalogue initial
--
-- Les durees sont indicatives et destinees a etre corrigees par l entreprise.
-- Aucun tarif n est fourni : Sophie ne doit jamais annoncer un prix qui ne
-- vient pas de l entreprise elle-meme (section 9).
-- -----------------------------------------------------------------------------
insert into public.profession_templates
  (slug, label, sort_order, allows_custom_label, default_appointment_minutes,
   suggested_services, qualification_questions, urgency_categories, vocabulary)
values
  ('plombier', 'Plombier', 10, false, 60,
   '[{"name":"Fuite d''eau","duration_minutes":60,"is_urgent":true,"collect":["adresse","etage","origine de la fuite"]},
     {"name":"Debouchage","duration_minutes":60,"is_urgent":true,"collect":["adresse","type d''evacuation"]},
     {"name":"Remplacement de sanitaire","duration_minutes":120,"is_urgent":false,"collect":["adresse","equipement concerne"]},
     {"name":"Installation chauffe-eau","duration_minutes":180,"is_urgent":false,"collect":["adresse","energie","emplacement"]},
     {"name":"Devis renovation","duration_minutes":45,"is_urgent":false,"collect":["adresse","surface","nature des travaux"]}]'::jsonb,
   '["Est-ce que l''eau coule encore en ce moment ?","Avez-vous pu couper l''arrivee d''eau ?","A quel etage se trouve le probleme ?","Y a-t-il des degats chez un voisin ?"]'::jsonb,
   '["Fuite non maitrisee","Degat des eaux","Absence totale d''eau","Fuite chez un voisin"]'::jsonb,
   '{"intervention":"depannage","client":"client","lieu":"chantier"}'::jsonb),

  ('electricien', 'Electricien', 20, false, 60,
   '[{"name":"Panne electrique","duration_minutes":60,"is_urgent":true,"collect":["adresse","zone concernee","depuis quand"]},
     {"name":"Tableau electrique","duration_minutes":180,"is_urgent":false,"collect":["adresse","age de l''installation"]},
     {"name":"Pose de prises ou d''eclairage","duration_minutes":90,"is_urgent":false,"collect":["adresse","nombre de points"]},
     {"name":"Mise aux normes","duration_minutes":240,"is_urgent":false,"collect":["adresse","surface"]},
     {"name":"Borne de recharge","duration_minutes":240,"is_urgent":false,"collect":["adresse","vehicule","emplacement"]}]'::jsonb,
   '["Le disjoncteur general a-t-il saute ?","La panne touche-t-elle tout le logement ?","Sentez-vous une odeur de brule ?"]'::jsonb,
   '["Odeur de brule","Etincelles ou echauffement","Coupure totale","Fils denudes accessibles"]'::jsonb,
   '{"intervention":"intervention","client":"client","lieu":"installation"}'::jsonb),

  ('serrurier', 'Serrurier', 30, false, 45,
   '[{"name":"Ouverture de porte","duration_minutes":45,"is_urgent":true,"collect":["adresse","type de porte","personne a l''interieur"]},
     {"name":"Remplacement de cylindre","duration_minutes":45,"is_urgent":false,"collect":["adresse","marque si connue"]},
     {"name":"Blindage ou renforcement","duration_minutes":180,"is_urgent":false,"collect":["adresse","type de porte"]},
     {"name":"Apres effraction","duration_minutes":90,"is_urgent":true,"collect":["adresse","porte encore fermante"]}]'::jsonb,
   '["Etes-vous actuellement enferme dehors ?","Y a-t-il quelqu''un ou un animal a l''interieur ?","La porte est-elle claquee ou verrouillee ?"]'::jsonb,
   '["Personne enfermee","Enfant ou animal seul a l''interieur","Effraction en cours ou recente","Porte ne fermant plus"]'::jsonb,
   '{"intervention":"depannage","client":"client","lieu":"adresse"}'::jsonb),

  ('chauffagiste', 'Chauffagiste', 40, false, 90,
   '[{"name":"Panne de chaudiere","duration_minutes":90,"is_urgent":true,"collect":["adresse","marque","code d''erreur"]},
     {"name":"Entretien annuel","duration_minutes":60,"is_urgent":false,"collect":["adresse","marque","derniere revision"]},
     {"name":"Remplacement de chaudiere","duration_minutes":300,"is_urgent":false,"collect":["adresse","energie","surface"]},
     {"name":"Radiateurs et desembouage","duration_minutes":120,"is_urgent":false,"collect":["adresse","nombre de radiateurs"]}]'::jsonb,
   '["Avez-vous encore de l''eau chaude ?","Un code d''erreur s''affiche-t-il ?","La chaudiere est-elle sous garantie ou sous contrat ?"]'::jsonb,
   '["Absence de chauffage par temps froid","Odeur de gaz","Fuite sur la chaudiere","Personne vulnerable au domicile"]'::jsonb,
   '{"intervention":"intervention","client":"client","lieu":"logement"}'::jsonb),

  ('climaticien', 'Climaticien', 50, false, 90,
   '[{"name":"Panne de climatisation","duration_minutes":90,"is_urgent":true,"collect":["adresse","marque","symptome"]},
     {"name":"Entretien et recharge","duration_minutes":60,"is_urgent":false,"collect":["adresse","nombre d''unites"]},
     {"name":"Installation","duration_minutes":300,"is_urgent":false,"collect":["adresse","surface","nombre de pieces"]},
     {"name":"Pompe a chaleur","duration_minutes":300,"is_urgent":false,"collect":["adresse","surface","installation existante"]}]'::jsonb,
   '["L''unite demarre-t-elle du tout ?","Y a-t-il un ecoulement d''eau ?","Depuis combien de temps ?"]'::jsonb,
   '["Local professionnel sensible","Personne vulnerable en forte chaleur","Fuite de fluide","Ecoulement dans le logement"]'::jsonb,
   '{"intervention":"intervention","client":"client","lieu":"site"}'::jsonb),

  ('garagiste', 'Garagiste', 60, false, 60,
   '[{"name":"Diagnostic","duration_minutes":60,"is_urgent":false,"collect":["vehicule","immatriculation","symptome"]},
     {"name":"Entretien et vidange","duration_minutes":90,"is_urgent":false,"collect":["vehicule","kilometrage"]},
     {"name":"Freins","duration_minutes":120,"is_urgent":true,"collect":["vehicule","bruit ou vibration"]},
     {"name":"Pneus","duration_minutes":60,"is_urgent":false,"collect":["vehicule","dimensions"]},
     {"name":"Preparation controle technique","duration_minutes":90,"is_urgent":false,"collect":["vehicule","date du controle"]}]'::jsonb,
   '["Quel est le modele et l''annee du vehicule ?","Le vehicule roule-t-il encore ?","Un voyant est-il allume ?"]'::jsonb,
   '["Probleme de freinage","Vehicule immobilise","Fumee ou surchauffe","Direction anormale"]'::jsonb,
   '{"intervention":"passage a l''atelier","client":"client","lieu":"atelier"}'::jsonb),

  ('jardinier', 'Jardinier', 70, false, 120,
   '[{"name":"Tonte et entretien","duration_minutes":120,"is_urgent":false,"collect":["adresse","surface"]},
     {"name":"Taille de haies","duration_minutes":180,"is_urgent":false,"collect":["adresse","longueur","hauteur"]},
     {"name":"Elagage","duration_minutes":240,"is_urgent":false,"collect":["adresse","nombre d''arbres","hauteur"]},
     {"name":"Creation d''espace vert","duration_minutes":300,"is_urgent":false,"collect":["adresse","surface","projet"]}]'::jsonb,
   '["Quelle est la surface approximative ?","Le terrain est-il accessible par vehicule ?","Souhaitez-vous l''evacuation des dechets verts ?"]'::jsonb,
   '["Arbre menacant de tomber","Branche sur la voie publique","Apres tempete"]'::jsonb,
   '{"intervention":"passage","client":"client","lieu":"terrain"}'::jsonb),

  ('peintre', 'Peintre', 80, false, 60,
   '[{"name":"Devis peinture interieure","duration_minutes":45,"is_urgent":false,"collect":["adresse","surface","nombre de pieces"]},
     {"name":"Peinture exterieure","duration_minutes":60,"is_urgent":false,"collect":["adresse","surface","hauteur"]},
     {"name":"Enduits et preparation","duration_minutes":60,"is_urgent":false,"collect":["adresse","etat des murs"]},
     {"name":"Pose de revetements","duration_minutes":60,"is_urgent":false,"collect":["adresse","type de revetement","surface"]}]'::jsonb,
   '["Combien de pieces sont concernees ?","Les murs sont-ils deja prepares ?","Le logement est-il occupe pendant les travaux ?"]'::jsonb,
   '["Remise en etat apres degat des eaux","Delai de location contraint"]'::jsonb,
   '{"intervention":"chantier","client":"client","lieu":"chantier"}'::jsonb),

  ('menuisier', 'Menuisier', 90, false, 60,
   '[{"name":"Devis sur mesure","duration_minutes":60,"is_urgent":false,"collect":["adresse","projet","dimensions"]},
     {"name":"Pose de fenetres ou portes","duration_minutes":240,"is_urgent":false,"collect":["adresse","nombre d''ouvertures","materiau"]},
     {"name":"Reparation","duration_minutes":90,"is_urgent":false,"collect":["adresse","element concerne"]},
     {"name":"Parquet","duration_minutes":300,"is_urgent":false,"collect":["adresse","surface","type de pose"]}]'::jsonb,
   '["Quelles sont les dimensions approximatives ?","S''agit-il de bois, PVC ou aluminium ?","Est-ce une renovation ou du neuf ?"]'::jsonb,
   '["Ouverture ne fermant plus","Securisation apres effraction"]'::jsonb,
   '{"intervention":"chantier","client":"client","lieu":"chantier"}'::jsonb),

  ('nettoyage', 'Entreprise de nettoyage', 100, false, 120,
   '[{"name":"Nettoyage regulier","duration_minutes":120,"is_urgent":false,"collect":["adresse","surface","frequence souhaitee"]},
     {"name":"Nettoyage de fin de chantier","duration_minutes":240,"is_urgent":false,"collect":["adresse","surface"]},
     {"name":"Remise en etat","duration_minutes":300,"is_urgent":false,"collect":["adresse","surface","etat"]},
     {"name":"Vitrerie","duration_minutes":120,"is_urgent":false,"collect":["adresse","nombre de vitres","hauteur"]}]'::jsonb,
   '["Quelle est la surface a traiter ?","Souhaitez-vous une prestation ponctuelle ou reguliere ?","A quels horaires le site est-il accessible ?"]'::jsonb,
   '["Remise en etat urgente avant etat des lieux","Sinistre a nettoyer"]'::jsonb,
   '{"intervention":"prestation","client":"client","lieu":"site"}'::jsonb),

  ('technicien', 'Technicien', 110, false, 60,
   '[{"name":"Diagnostic","duration_minutes":60,"is_urgent":false,"collect":["adresse","equipement","symptome"]},
     {"name":"Reparation","duration_minutes":90,"is_urgent":false,"collect":["adresse","equipement","marque"]},
     {"name":"Installation","duration_minutes":120,"is_urgent":false,"collect":["adresse","equipement"]},
     {"name":"Maintenance","duration_minutes":90,"is_urgent":false,"collect":["adresse","contrat en cours"]}]'::jsonb,
   '["De quel equipement s''agit-il ?","Depuis quand le probleme est-il present ?","L''equipement est-il sous garantie ?"]'::jsonb,
   '["Equipement critique a l''arret","Risque pour la securite"]'::jsonb,
   '{"intervention":"intervention","client":"client","lieu":"site"}'::jsonb),

  ('autre', 'Autre metier', 999, true, 60,
   '[{"name":"Premier rendez-vous","duration_minutes":60,"is_urgent":false,"collect":["adresse","nature de la demande"]},
     {"name":"Intervention","duration_minutes":90,"is_urgent":false,"collect":["adresse","description"]},
     {"name":"Devis","duration_minutes":45,"is_urgent":false,"collect":["adresse","projet"]}]'::jsonb,
   '["Pouvez-vous decrire votre demande ?","A quelle adresse l''intervention doit-elle avoir lieu ?","Y a-t-il une urgence particuliere ?"]'::jsonb,
   '["Demande signalee comme urgente par le client"]'::jsonb,
   '{"intervention":"intervention","client":"client","lieu":"site"}'::jsonb);
