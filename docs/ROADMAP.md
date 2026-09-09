# Feuille de route

Une phase se termine par : typecheck, lint, tests, build, migrations vérifiées,
documentation à jour, `CHANGELOG` et `CLAUDE_HANDOFF` mis à jour, version incrémentée,
archive ZIP, message de commit proposé, **état de maturité annoncé**, puis votre validation
avant la phase suivante.

## Les trois états de maturité

`TECHNICALLY READY` · `LEGAL REVIEW REQUIRED` · `PRODUCTION READY`
Définitions dans `docs/LEGAL_COMPLIANCE.md` (ADR-016).

Les phases techniques ne sont pas bloquées par la conformité. C'est la mise en service —
vrais clients, vrais appels, vrais enregistrements — qui l'est. Aucune version n'est
annoncée `PRODUCTION READY` tant que la `PRE_PRODUCTION_LEGAL_CHECKLIST` applicable n'est
pas validée par un juriste, avec un nom et une date.

| Phase | Contenu | Version | État |
|---|---|---|---|
| **0** | structure, Supabase, Auth, multi-tenant, migrations, RLS, design system, documentation | 0.1.0 | **terminée** |
| **0+** | rétention audio 30 jours, cadre de conformité, annonce configurable | 0.1.2 | **terminée** |
| **1** | onboarding complet, métiers, services, horaires, BusinessProfile, ProfessionTemplates, SophieConfiguration, BusinessKnowledge | 0.2.0 | **terminée** |
| **2** | contacts, leads, tâches, Activity, tableau de bord, recherche | 0.3.0 | **terminée** |
| 3 | Google Calendar, AvailabilityEngine, holds, rendez-vous, conflits, états | 0.4.0 | à venir |
| 4 | téléphonie, appels entrants, SophieEngine, VoiceAIProvider, outils, transfert, repli | 0.5.0 | à venir |
| 5 | enregistrement, stockage audio, lecteur, transcription, résumé, extraction, jobs, retry | 0.6.0 | à venir |
| 6 | validation, modification, refus, annulation, Calendar, SMS, notifications, historique | 0.7.0 | à venir |
| 7 | console plateforme, profils métier, plans, abonnements, usage, santé système | 0.8.0 | à venir |
| 8 | sécurité, tests, performance, observabilité, accessibilité, PWA, staging, production | 1.0.0 | à venir |

## Portes juridiques

Ces points ne bloquent aucun développement. Ils bloquent la mise en service.

| Porte | Doit être franchie avant | Checklist |
|---|---|---|
| DPA client signé | premier client réel | L1 |
| Registre des sous-traitants contractualisé | premier appel réel | L2 |
| Politique de confidentialité et CGU/CGV publiées | première inscription réelle | L3, L4 |
| Durées de conservation fixées | premier appel réel | L5, ADR-018 |
| Procédure droits des personnes | premier client réel | L6 |
| Rôle de Sophie IA qualifié par traitement | L1 et L3 | L7 |
| Annonce téléphonique validée par pays | premier enregistrement réel | L8, L9, L12 |
| Registre des traitements, AIPD si nécessaire | premier client réel | L10, L11 |

Le garde-fou de l'annonce est déjà technique : `recording_allowed()` refuse en base
d'enregistrer un appel réel si le modèle applicable n'est pas marqué validé (ADR-015).

## Ce qui bloque quoi

- La Phase 4 ne peut pas commencer sans le choix du fournisseur de téléphonie et de voix
  (compte, carte bancaire, numéro). Décision à prendre pendant la Phase 3.
- La Phase 3 demande un projet Google Cloud et des identifiants OAuth. À préparer pendant
  la Phase 2.
- La Phase 1 ne demande **aucun** compte externe supplémentaire : seulement Supabase.
- Le travail juridique peut démarrer **dès maintenant**, en parallèle des phases 1 à 3. Il
  n'a pas besoin d'attendre que le produit soit fini, et il vaut mieux qu'il ne l'attende
  pas : le choix du fournisseur Voice (Phase 4) dépend en partie de ses garanties
  contractuelles.

## Dépendances entre phases

```
0 ──► 1 ──► 2 ──► 3 ──► 4 ──► 5 ──► 6 ──► 7 ──► 8
             │            └────────────┘
             └── le CRM doit exister avant que Sophie ait quelque chose à remplir
```
