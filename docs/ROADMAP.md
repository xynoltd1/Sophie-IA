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
| **3** | Google Calendar, AvailabilityEngine, holds, rendez-vous, conflits, états | 0.5.0 | **écrite, en attente du compte Google** |
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


## État au 2026-11-02 (version 0.15.0)

### Phases terminées, au sens du code

| Phase | État |
|---|---|
| 0 — Fondations | fait, vérifié contre la vraie base |
| 1 — Entreprise et Sophie | fait, plus les écrans de modification après inscription |
| 2 — CRM | fait |
| 3 — Agenda | fait, vérifié avec Google |
| 4 — Téléphonie et voix | fait, vérifié par de vrais appels depuis le navigateur |
| 5 — Intelligence post-appel | audio et transcription vérifiés ; résumé et extraction écrits, jamais exercés |
| 6 — Workflow complet | écrit en entier ; SMS jamais envoyé pour de vrai |
| 7 — Administration SaaS | écrit en entier, jamais exercé en conditions réelles |
| 8 — Durcissement | partiel : tests et documentation à jour, conservation et observabilité faites en 0.15.0, préproduction documentée mais non montée |

### Ce qui n'avance plus sans vous

1. **Un numéro de téléphone.** Tant qu'il n'y en a pas, tous les appels sont des essais et
   rien ne peut être vérifié de bout en bout.
2. **Une clé de fournisseur d'IA.** Sans elle, le résumé reste simulé.
3. **Un compte opérateur SMS.** Sans lui, les messages restent en file.
4. **La validation de l'application Google.** Sans elle, chaque client perd son agenda sept
   jours après l'avoir connecté.
5. **La liste juridique** de `LEGAL_COMPLIANCE.md`, points L1 à L12.

### Ce qui reste à construire, et qui ne dépend de personne

- Adaptateurs WhatsApp, e-mail, formulaire web.
- Envoi des invitations par e-mail (aujourd'hui, le lien est affiché et transmis à la main).
- Réglages de notification par utilisateur.
- Tests de bout en bout automatisés sur un environnement de préproduction.

---

# Phase 9 — Les devis

**Décidée le 19 novembre 2026.** Développement commencé en 0.23.0, en parallèle
de l'attente des tests d'appel réels.

## Pourquoi les devis, et maintenant

Zeli reconnaît déjà l'intention « demande de devis » et crée le prospect. Mais
l'artisan doit ensuite ouvrir un autre outil, retrouver l'adresse, retaper le
problème. Le travail que Zeli a fait au téléphone s'arrête là.

Le socle existe : contacts, prospects, services, organisations, isolation
multi-entreprises. Il manque le document.

Et c'est la partie du cahier des charges qui peut avancer **sans numéro de
téléphone, sans clé IA, sans compte SMS**. Tout le reste attend.

## Périmètre

| | |
|---|---|
| Lignes de devis | désignation, quantité, prix unitaire, TVA par ligne |
| Montants | en centimes entiers, recalculés côté serveur à chaque écriture |
| TVA | par ligne — un même devis mêle souvent 6 % et 21 % en Belgique |
| Numérotation | par entreprise et par année, sans trou |
| États | BROUILLON → ENVOYE → ACCEPTE / REFUSE / EXPIRE |
| Origine | créé à la main, ou depuis un appel ou un prospect |
| Validité | date d'échéance, expiration automatique |
| Envoi | lien public à jeton, puis PDF |
| Acceptation | le client accepte depuis le lien ; l'artisan peut aussi marquer |

## Hors périmètre, définitivement

**Les factures ne seront pas dans Zelicall.** Ce n'est pas un report, c'est une
décision (ADR-055).

Depuis le 1er janvier 2026, toute entreprise assujettie à la TVA établie en
Belgique doit émettre et recevoir des factures électroniques **structurées**
pour ses opérations entre professionnels. Un PDF envoyé par courriel ne suffit
plus. Il faut un point d'accès au réseau Peppol, un format structuré, une
numérotation continue opposable, un archivage de dix ans, et des règles de TVA
qui diffèrent entre la Belgique et la France.

Ce n'est pas une fonctionnalité de plus dans une secrétaire téléphonique.
C'est un logiciel de comptabilité, avec sa responsabilité propre.

Un devis, lui, n'engage que commercialement : pas de déclaration de TVA, pas
de numérotation opposable, pas d'archivage obligatoire. La différence de
charge entre les deux est ce qui rend l'un raisonnable et l'autre non.

## Découpage

**9.1 — Base et calculs** (0.23.0) · la table, les lignes, la numérotation, le
calcul des totaux côté serveur, l'isolation entre entreprises, les tests.

**9.2 — Écrans** · liste, création depuis un appel ou un prospect, édition des
lignes, changement d'état.

**9.3 — Envoi** · lien public à jeton, page de consultation, acceptation par le
client, PDF.

**9.4 — Relances** · devis qui approche de son échéance, relance par SMS.
