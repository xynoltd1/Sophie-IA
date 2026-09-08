-- =============================================================================
-- Verification du contenu de reference
--
-- Script en LECTURE SEULE. A executer apres 01_verify_schema.sql.
-- Il verifie que les donnees livrees avec les migrations sont bien la, et que
-- les garde-fous de conformite sont dans l etat attendu.
-- =============================================================================

select 'metiers publies' as controle,
       count(*)::text     as valeur,
       case when count(*) >= 12 then 'OK' else 'INCOMPLET — migration 0009 ?' end as etat
from public.profession_templates where is_published

union all

select 'metier avec saisie libre (Autre)',
       count(*)::text,
       case when count(*) = 1 then 'OK' else 'INATTENDU' end
from public.profession_templates where allows_custom_label

union all

select 'modeles d annonce telephonique',
       count(*)::text,
       case when count(*) >= 4 then 'OK' else 'INCOMPLET — migration 0007 ?' end
from public.recording_notice_templates

union all

-- Attendu : AUCUN modele valide. Si ce compteur n est pas a zero, quelqu un a
-- marque un texte comme juridiquement valide. Voir docs/LEGAL_COMPLIANCE.md (L9).
select 'annonces marquees juridiquement validees',
       count(*)::text,
       case when count(*) = 0
            then 'OK — aucune, conforme a l etat actuel du projet'
            else 'A VERIFIER — qui a valide, et sur quelle base ?' end
from public.recording_notice_templates where is_legally_validated

union all

-- Attendu : AUCUNE. L enregistrement est desactive par defaut.
select 'organisations avec enregistrement actif',
       count(*)::text,
       case when count(*) = 0 then 'OK' else 'A VERIFIER' end
from public.organizations where recording_enabled

union all

select 'organisations de test',
       count(*)::text,
       'informatif'
from public.organizations where is_test_organization

union all

select 'plafond de retention audio',
       coalesce(max(audio_retention_days)::text, 'aucune organisation'),
       case when coalesce(max(audio_retention_days), 0) <= 30 then 'OK' else 'ANOMALIE' end
from public.organizations;
