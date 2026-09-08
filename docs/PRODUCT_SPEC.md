# Spécification produit

Ce document résume le cahier des charges d'origine et signale les points qui demandent une
décision de votre part. Le cahier des charges complet reste la référence.

## Navigation

Cinq destinations, jamais plus : **Accueil · Prospects · Agenda · Appels · Plus**.

### Accueil
1. **À traiter** — urgences, rendez-vous à valider, tâches en retard, demandes importantes.
2. **Aujourd'hui** — les rendez-vous du jour.
3. **Activité Sophie** — appels, prospects, rendez-vous.

L'artisan doit comprendre sa situation en quelques secondes.

### Fiche appel
Contact, numéro, date, durée, statut, **lecteur audio**, résumé de Sophie, informations
structurées, transcription, rendez-vous associé, lead, tâches, actions.

Le lecteur audio est une exigence de la V1, pas une option.

### Fiche contact
Identité, téléphone, e-mail, adresse, prochain rendez-vous, leads, historique
chronologique. À terme, cet historique réunit téléphone, SMS, WhatsApp, e-mail et
formulaire web dans un seul fil.

## Onboarding

Sept étapes, sauvegardées au fur et à mesure, interruptibles et reprenables :
entreprise → métier → services → horaires → agenda → Sophie → appels.
Affichage de la progression : « Configuration de Sophie : 60 % ».

## Abonnements

`Plan`, `Subscription`, `UsageRecord`. Types d'usage : minutes vocales, SMS envoyés, usage
IA, stockage. Catégories prévues : Solo, Pro, Équipe. Affichage du type « 247 / 500
minutes ».

**Les prix ne sont pas fixés** : l'architecture les rend paramétrables, la décision
commerciale vous appartient. À noter : les minutes vocales dominent largement le coût de
revient, ce qui rend le compteur de minutes indispensable dès le premier client payant.

---

## Points à trancher avec vous

Ces questions changent le produit, engagent un coût ou comportent un risque juridique.
Elles ne peuvent pas être décidées à votre place.

### 1. Pays et enregistrement des appels — **tranché**
Lancement en **France et en Belgique**. L'audio est conservé **30 jours au maximum**, puis
purgé automatiquement ; la transcription et le résumé sont conservés. Voir ADR-013 et
ADR-014, et la section « Enregistrement des appels » de `docs/SECURITY.md`.

Reste à faire, hors code : le contrat de sous-traitance à faire signer aux entreprises
clientes, les contrats avec les fournisseurs de voix et d'IA, et la validation du texte
d'annonce par un juriste. Ces trois points doivent être réglés avant le premier client
réel, pas avant la Phase 4.

### 2. Fournisseur de téléphonie et de voix
Le critère technique décisif est posé (ADR-002) : le fournisseur Voice doit pouvoir
appeler nos outils HTTP pendant l'appel. Le choix implique un compte, une carte bancaire,
et un numéro de téléphone par entreprise cliente. À décider avant la Phase 4.

### 3. Numéro de téléphone
Trois modèles possibles : un numéro fourni par Sophie IA, un renvoi depuis le numéro
existant de l'artisan, ou un portage. Ce choix change l'onboarding et le discours
commercial. Le renvoi conditionnel est généralement le plus simple à vendre.

### 4. Enregistrement, transcription et sous-traitance
Les enregistrements contiennent des données personnelles de tiers (les clients de vos
clients). Il faudra des contrats de sous-traitance avec les fournisseurs de voix et d'IA,
et une politique de rétention par défaut. À préparer avant les premiers clients réels.

### 5. Notifications sur iPhone
Les notifications push d'une PWA sur iOS ne fonctionnent que si l'application a été
installée sur l'écran d'accueil. Comme les notifications sont au cœur du produit
(« rendez-vous à valider »), l'installation doit être une étape guidée de l'onboarding, et
non une suggestion facultative. Un repli par SMS pour les urgences est à envisager.
