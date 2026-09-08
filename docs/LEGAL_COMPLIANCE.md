# Conformité juridique

> **Ce document n'est pas un avis juridique.** Il est rédigé par l'équipe technique pour
> préparer le travail d'un juriste, pas pour s'y substituer. Aucun texte qu'il contient ne
> doit être présenté à un client ou à un appelant comme validé tant qu'un professionnel du
> droit ne l'a pas revu.

---

## Les trois états de maturité

Le projet distingue trois états. Ils sont indépendants : un logiciel peut être
irréprochable techniquement et rester interdit de production.

### TECHNICALLY READY
Le code fonctionne : typecheck, lint, tests et build passent, les migrations sont
appliquées, le parcours utilisateur va de bout en bout, les modes dégradés sont gérés.
**C'est l'état que le développement peut atteindre seul.**

### LEGAL REVIEW REQUIRED
Le périmètre touche des données personnelles, des enregistrements, des tiers ou des
sous-traitants. Un ou plusieurs points de la `PRE_PRODUCTION_LEGAL_CHECKLIST` ci-dessous
ne sont pas validés. **L'état par défaut de tout ce qui touche aux appels.**

### PRODUCTION READY
`TECHNICALLY READY` **et** toute la checklist applicable validée par un juriste, avec une
date et un nom. Seul cet état autorise de vrais clients, de vrais appels et de vrais
enregistrements.

**Règle du projet** : aucune version n'est annoncée `PRODUCTION READY` sur la seule foi
des tests. Les démonstrations, les environnements de développement et les appels de test
(`is_test = true`) ne sont pas concernés — ils ne mettent en jeu aucune donnée de tiers
réel.

---

## PRE_PRODUCTION_LEGAL_CHECKLIST

À valider par un juriste avant tout client réel. Chaque ligne se coche avec un nom et une
date, jamais « probablement bon ».

| # | Point | État | Bloquant pour |
|---|---|---|---|
| L1 | Contrat de sous-traitance (DPA) Sophie IA ↔ entreprise cliente | à faire | tout client réel |
| L2 | Registre des sous-traitants ultérieurs vérifié et contractualisé | à faire | tout appel réel |
| L3 | Politique de confidentialité de Sophie IA | à faire | toute inscription réelle |
| L4 | CGU / CGV | à faire | toute inscription réelle |
| L5 | Politique de conservation et de suppression (appels, audio, transcriptions) | à faire | tout appel réel |
| L6 | Procédure de gestion des demandes d'accès, de suppression et d'export | à faire | tout client réel |
| L7 | Qualification juridique du rôle de Sophie IA par traitement | à faire | L1 et L3 |
| L8 | Règles d'enregistrement et d'information téléphonique, par pays de lancement | à faire | tout enregistrement réel |
| L9 | Texte d'annonce téléphonique validé, par pays et par langue | à faire | tout enregistrement réel |
| L10 | Registre des activités de traitement de Sophie IA | à faire | tout client réel |
| L11 | Analyse d'impact (AIPD) : nécessaire ou non, et si oui réalisée | à faire | tout appel réel |
| L12 | Mentions d'information pour l'appelant (finalité, durée, droits) | à faire | tout enregistrement réel |

Pays de lancement retenus : **France et Belgique** (ADR-014). Toute ouverture d'un
troisième pays rouvre L8, L9 et L12.

---

## L1 — Contrat de sous-traitance (DPA) : clauses à faire rédiger

> Ce qui suit est une **liste de points à couvrir**, pas un contrat. Il ne faut ni la
> publier, ni la faire signer, ni la présenter comme un modèle juridique.

### Qualification des parties
- Qui est responsable de traitement, qui est sous-traitant, pour chaque traitement
  (voir L7 ci-dessous — la réponse n'est pas la même partout).
- Cas où Sophie IA agirait pour son propre compte (statistiques d'usage, facturation,
  amélioration du produit) : à traiter séparément, car le rôle change alors.

### Objet et périmètre
- Nature et finalité de chaque traitement.
- Catégories de données : identité de l'appelant, numéro de téléphone, adresse
  d'intervention, contenu de la conversation, enregistrement audio, transcription,
  extraction structurée.
- Catégories de personnes concernées : les clients de l'entreprise cliente, ses
  prospects, ses employés.
- Durée du traitement et sort des données à la fin du contrat.

### Obligations du sous-traitant
- Traitement sur instruction documentée uniquement.
- Confidentialité des personnes autorisées.
- Mesures de sécurité (à faire correspondre à ce que décrit `SECURITY.md`, sans promettre
  au-delà de ce qui est réellement implémenté).
- Conditions de recours à des sous-traitants ultérieurs : autorisation, information
  préalable des changements, droit d'opposition.
- Assistance au responsable de traitement : droits des personnes, notification de
  violation, AIPD.
- Suppression ou restitution des données en fin de contrat.
- Mise à disposition des éléments d'audit.

### Points spécifiques à ce produit
- **Enregistrement audio** : qui décide de l'activer, qui porte la responsabilité de
  l'annonce à l'appelant, quelle durée de conservation (30 jours maximum, ADR-013).
- **Transcription** : elle reste une donnée personnelle après la purge de l'audio. Sa
  propre durée de conservation doit être fixée et justifiée — c'est une question
  ouverte à ce jour.
- **Traitement par IA** : quel fournisseur, où, avec quelle garantie de non-réutilisation
  des contenus pour de l'entraînement.
- **Transferts hors UE** : le cas échéant, mécanisme de transfert applicable.
- Répartition des responsabilités en cas de plainte d'un appelant.

---

## L2 — Registre des fournisseurs et sous-traitants ultérieurs

Un sous-traitant ultérieur est un prestataire qui traite, pour le compte de Sophie IA, des
données appartenant aux clients de nos clients. Chacun exige un contrat, une vérification
de localisation, et une information des entreprises clientes.

État au 2026-09-07. Les cases « à vérifier » sont des questions ouvertes, pas des
affirmations.

### Supabase — base de données, authentification, stockage
- **Fonction** : PostgreSQL, Auth, Storage (audio), RLS.
- **Données concernées** : comptes utilisateurs, données d'entreprise, contacts, leads,
  appels, transcriptions, **enregistrements audio**.
- **Région** : choisie à la création du projet. **Décision : créer les projets en région
  européenne.** À vérifier et à consigner projet par projet (dev, staging, production).
- **Documents nécessaires** : DPA du prestataire, description des sous-traitants
  ultérieurs (Supabase s'appuie lui-même sur un hébergeur cloud), garanties de transfert
  le cas échéant.
- **À vérifier avant production** : région effective de chaque projet ; localisation des
  sauvegardes ; politique de rétention des journaux ; procédure de suppression définitive.

### Vercel — hébergement de l'application
- **Fonction** : exécution des pages et des Route Handlers, journaux de requêtes.
- **Données concernées** : données en transit, adresses IP, journaux techniques. Pas de
  stockage durable de données métier.
- **Région** : `vercel.json` fixe `fra1` (Francfort) depuis la version 0.1.5.
  **Constat du 2026-09-07** : le projet s'exécutait à `iad1` (Washington), donc hors UE.
  Corrigé au niveau du dépôt ; à confirmer dans *Project Settings → Functions*.
- **Point ouvert** : le middleware Next.js s'exécute sur le réseau de périphérie, réparti
  mondialement, indépendamment de la région des fonctions. Il ne traite que les cookies de
  session et le jeton d'authentification, sans donnée métier. À faire confirmer et
  consigner avant production.
- **Documents nécessaires** : DPA du prestataire ; liste de ses sous-traitants.
- **À vérifier avant production** : région d'exécution des fonctions ; durée de rétention
  des journaux ; absence de données personnelles dans les journaux applicatifs (à
  contrôler dans notre propre code — un `console.log` de payload est une fuite).

### Fournisseur de téléphonie et de SMS — non choisi
- **Fonction** : réception des appels, transfert, envoi des SMS de confirmation.
- **Données concernées** : numéros de téléphone appelant et appelé, métadonnées d'appel,
  contenu des SMS, potentiellement le flux audio.
- **Région** : **inconnue — décision ouverte**, dépend du prestataire retenu.
- **Documents nécessaires** : DPA, garanties de transfert, engagement sur la conservation
  des métadonnées et sur l'absence de conservation du média.
- **À vérifier avant production** : le prestataire conserve-t-il l'audio de son côté, et
  combien de temps ? Où sont hébergées les métadonnées d'appel ? Peut-on désactiver sa
  propre fonction d'enregistrement ?
- **Décision ouverte** — à trancher pendant la Phase 3, avant la Phase 4 (voir ROADMAP).

### Fournisseur Voice IA — non choisi
- **Fonction** : conversation vocale temps réel, appel des outils métier.
- **Données concernées** : **le contenu intégral de la conversation**, donc potentiellement
  des données sensibles évoquées spontanément par un appelant.
- **Région** : **inconnue — décision ouverte**.
- **Documents nécessaires** : DPA ; engagement écrit de non-réutilisation des contenus
  pour l'entraînement de modèles ; garanties de transfert si hors UE.
- **À vérifier avant production** : durée de conservation des transcriptions chez le
  prestataire ; possibilité d'opt-out de la conservation ; sous-traitants ultérieurs.
- C'est le fournisseur le plus sensible du registre : il voit tout ce que disent les
  clients de nos clients.

### Fournisseur IA post-appel (transcription, résumé, extraction) — non choisi
- **Fonction** : transcrire, résumer, extraire les champs structurés.
- **Données concernées** : audio, transcription intégrale.
- **Région** : **inconnue — décision ouverte**.
- **Documents nécessaires** : identiques au fournisseur Voice.
- **À vérifier avant production** : mêmes points ; possibilité d'un traitement en UE.

### Google Calendar — intégration agenda
- **Fonction** : lecture des disponibilités, création et mise à jour des événements.
- **Données concernées** : événements de l'agenda professionnel, nom et coordonnées du
  client dans l'événement créé.
- **Région** : hors UE, avec mécanismes de transfert propres au prestataire.
- **Documents nécessaires** : conditions applicables à l'API ; vérification du périmètre
  OAuth demandé (le minimum strict, jamais un accès large).
- **À vérifier avant production** : quelles données personnelles sont écrites dans
  l'événement ; l'entreprise cliente en est-elle informée ; que se passe-t-il à la
  révocation de l'accès.

### Prestataires futurs
Toute nouvelle intégration — WhatsApp, e-mail transactionnel, paiement, supervision,
analytique — s'ajoute à ce registre **avant** d'être branchée, pas après. Une intégration
absente de ce tableau ne doit pas atteindre la production.

---

## L7 — Qualification du rôle de Sophie IA, par traitement

Le rôle n'est pas le même partout. C'est le point que le juriste doit trancher, et il
conditionne L1 et L3.

| Traitement | Qualification pressentie | À faire confirmer |
|---|---|---|
| Appels, transcriptions, contacts, rendez-vous des clients de l'artisan | Sophie IA sous-traitant, artisan responsable | oui |
| Comptes des utilisateurs de l'application (artisans) | Sophie IA responsable | oui |
| Facturation et abonnements | Sophie IA responsable | oui |
| Journaux techniques et de sécurité | à qualifier | oui |
| Statistiques d'usage agrégées | à qualifier — le rôle change si les données servent à améliorer le produit | oui |

---

## L5 — Conservation et suppression : ce qui est décidé et ce qui ne l'est pas

| Donnée | Durée | État |
|---|---|---|
| Enregistrement audio | 30 jours maximum, purge automatique | **décidé** (ADR-013), implémenté en base |
| Transcription | non fixée | **décision ouverte** — à trancher avec le juriste |
| Résumé et extraction structurée | non fixée | **décision ouverte** |
| Contact, lead, rendez-vous | durée de la relation commerciale, puis archivage | **décision ouverte** |
| Journaux d'audit | non fixée | **décision ouverte** |
| Compte utilisateur après résiliation | non fixée | **décision ouverte** |

Une durée non fixée n'est pas une durée illimitée : c'est un point bloquant de la
checklist. Tant qu'elle n'est pas décidée, aucun client réel.

---

## L9 — Texte d'annonce téléphonique

Le texte actuellement présent dans le code est un **placeholder explicitement marqué
`NON VALIDÉ JURIDIQUEMENT`**. Il sert au développement et aux appels de test.

Contraintes d'implémentation, déjà en place :
- le texte est **une donnée, pas du code** : table `recording_notice_templates`, résolue
  par pays et par langue au moment de l'appel ;
- chaque modèle porte un champ `is_legally_validated`, `false` par défaut ;
- une entreprise peut personnaliser son propre texte ;
- **le système refuse d'activer l'enregistrement en production si le modèle applicable
  n'est pas marqué validé.** Le garde-fou est en base, pas dans l'interface.

Ce que le juriste doit fournir, par pays et par langue : le texte exact, le moment où il
doit être prononcé, et ce qui se passe si l'appelant s'y oppose.

---

---

## Faire ses propres essais d'enregistrement

Tester le produit avant la validation juridique est possible, et prévu. Deux conditions,
l'une technique et l'autre humaine.

### Condition technique — automatique

Les essais se font dans une **organisation d'essai** (`is_test_organization = true`,
ADR-019). Seule l'administration de la plateforme peut la créer ; un propriétaire ne peut
pas cocher la case lui-même. Dans une organisation normale, le drapeau `is_test` d'un appel
est purement ignoré : l'appel est traité comme réel et l'annonce validée redevient
obligatoire.

### Condition humaine — à votre charge

Un appel est un essai si **toutes** les personnes en ligne savent ce qui se passe et sont
d'accord : vous, un collègue, un proche prévenu. Dès qu'un vrai client, un vrai prospect ou
un appelant de passage est au bout du fil, ce n'est plus un essai — le drapeau décrit une
intention, il ne change pas la nature de la conversation.

### Règles pratiques

- Un numéro dédié aux essais, jamais celui d'un artisan en activité.
- Projet Supabase de développement ou de staging, jamais la production.
- Prévenir par écrit les personnes qui joueront le rôle du client appelant.
- Garder la purge à 30 jours active, y compris sur les essais : autant vérifier tout de
  suite qu'elle fonctionne.

## Ce que la conformité ne bloque pas

Le développement technique continue normalement : phases 1 à 8, environnements de
développement et de staging, appels marqués `is_test = true`, démonstrations sur données
fictives.

Ce qui est bloqué tant que la checklist n'est pas validée : de vrais clients, de vrais
appels entrants, de vrais enregistrements, et toute communication annonçant le produit
comme `PRODUCTION READY`.

Les essais dans une organisation d'essai ne sont pas concernés — voir la section
précédente.
