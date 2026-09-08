# Intégrations

Chaque intégration passe par une interface définie côté domaine. Le code métier ne connaît
jamais le nom d'un fournisseur : changer de prestataire ne doit toucher qu'un adaptateur.

| Interface | Rôle | Phase | État |
|---|---|---|---|
| `CalendarProvider` | disponibilités et événements | 3 | non commencé |
| `TelephonyProvider` | appels entrants, transfert, enregistrement | 4 | non commencé |
| `VoiceAIProvider` | session vocale temps réel, outils | 4 | non commencé |
| `AIProvider` | transcription, résumé, extraction | 5 | non commencé |
| `MessagingProvider` | SMS, puis WhatsApp et e-mail | 6 | non commencé |
| `StorageProvider` | audio en bucket privé, URL signées | 5 | Supabase Storage retenu |

## Mode simulé

Chaque adaptateur a une implémentation `mock`, utilisée quand la variable
`*_PROVIDER=mock`. Elle est **visiblement marquée** dans l'interface et dans les journaux.

Ce que le mode simulé ne fait jamais : prétendre qu'un SMS est parti, qu'un événement
Calendar a été créé, ou qu'un appel a eu lieu. Un envoi simulé s'affiche comme simulé.

## Google Calendar (Phase 3)

- OAuth avec le périmètre minimal nécessaire, jamais un accès large « au cas où ».
- Les jetons de rafraîchissement sont chiffrés en base et ne sortent jamais du serveur.
- Les abonnements aux notifications de changement expirent : leur renouvellement doit être
  une tâche planifiée, sinon la synchronisation s'arrête silencieusement après quelques
  jours.
- Si Calendar est indisponible, Sophie ne propose aucun créneau. Voir
  `docs/BUSINESS_RULES.md`.

## Téléphonie et voix (Phase 4)

Point structurant, déjà tranché en ADR-002 : **le flux audio ne passe pas par Vercel.** Le
fournisseur Voice doit donc être capable d'appeler nos outils HTTP pendant la conversation.
C'est le premier critère de choix du prestataire, avant le prix et avant la qualité de voix.

Les webhooks entrants sont authentifiés par signature, protégés contre le rejeu et limités
en débit. Un mécanisme de repli est prévu en cas de panne du fournisseur.

## Variables d'environnement

Toutes sont listées dans `.env.example`, groupées par phase. Une variable manquante doit
produire un message d'erreur clair au démarrage, pas un comportement dégradé silencieux.
