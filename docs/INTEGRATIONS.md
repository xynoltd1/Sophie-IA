# Intégrations

Chaque intégration passe par une interface définie côté domaine. Le code métier ne connaît
jamais le nom d'un fournisseur : changer de prestataire ne doit toucher qu'un adaptateur.

## États

Quatre états, et un seul autorise à dire qu'une intégration fonctionne.

| État | Signification |
|---|---|
| `IMPLEMENTED_UNTESTED` | Le code existe et compile. Jamais exercé contre le service réel. |
| `TESTED` | Exercé avec succès contre le service réel, au moins une fois. |
| `BLOCKED_EXTERNAL_CONFIG` | Le code est prêt ; il manque un compte, une clé ou une configuration. |
| `PRODUCTION_READY` | Testé, surveillé, et couvert par les obligations juridiques applicables. |

**La source de vérité est `src/lib/providers/status.ts`**, pas ce tableau. Un test
vérifie qu'aucune intégration externe n'y est déclarée `PRODUCTION_READY`.

## État au 2026-09-24

| Intégration | État | Ce qui manque |
|---|---|---|
| Supabase | `TESTED` | rien |
| Google Calendar | `BLOCKED_EXTERNAL_CONFIG` | projet Google Cloud et identifiants OAuth |
| Téléphonie | `BLOCKED_EXTERNAL_CONFIG` | compte opérateur et numéro |
| Sophie Voice | `BLOCKED_EXTERNAL_CONFIG` | compte Vapi en région européenne |
| Transcription et résumé | `BLOCKED_EXTERNAL_CONFIG` | fournisseur non choisi |
| SMS | `BLOCKED_EXTERNAL_CONFIG` | dépend du choix de l'opérateur |

## Abstractions

| Interface | Fichier | Rôle |
|---|---|---|
| `CalendarProvider` | `src/lib/providers/calendar/types.ts` | disponibilités et événements |
| `TelephonyProvider` | `src/lib/providers/telephony/types.ts` | numéros, appels entrants, transfert |
| `VoiceAIProvider` | `src/lib/providers/voice/types.ts` | conversation temps réel et appels d'outils |
| `MessagingProvider` | `src/lib/providers/messaging/types.ts` | SMS, puis WhatsApp et e-mail |
| `TranscriptionProvider` | `src/lib/providers/transcription/types.ts` | transcription, résumé, extraction |

Une seule implémentation existe aujourd'hui : `GoogleCalendarProvider`. L'adaptateur
`VapiVoiceProvider` existe pour la partie qui se teste sans compte — signature et décodage.

## Google Calendar

**Ce qui est écrit** : flux OAuth avec état signé, chiffrement des jetons, rafraîchissement
automatique, synchronisation incrémentale avec reprise complète quand Google refuse le
jeton, webhook de notification, job planifié de rattrapage, écriture des rendez-vous
confirmés dans l'agenda, suppression à l'annulation.

**Ce qui n'a jamais été exercé** : tout. Aucune requête n'est encore partie vers Google.

**Périmètre OAuth demandé** : `calendar.events` uniquement — lire et écrire des
événements, rien d'autre. Pas d'accès aux contacts, pas aux e-mails, pas de création
d'agendas (section 41, permissions minimales).

**Mode dégradé** : `calendar_sync_state()` distingue trois situations — non connecté,
connecté et à jour, connecté mais périmé. Le troisième cas est le plus dangereux parce
qu'il ressemble au deuxième. L'outil `check_availability` de Sophie **refuse de proposer
un créneau** quand la synchronisation est périmée, et annonce que le professionnel
confirmera (sections 19 et 43).

## Sophie Voice

Architecture retenue : **Vapi en région européenne, avec trunk SIP apporté** (ADR-020).

Le raisonnement complet figure dans `DECISIONS.md`. En une phrase : l'API Realtime
d'OpenAI en mode SIP exige une connexion WebSocket maintenue pendant tout l'appel, ce que
les fonctions Vercel ne permettent pas — cette contrainte tranche le débat avant tout
argument de coût.

**Ce qui est écrit et testé sans compte** : vérification de signature HMAC avec protection
contre le rejeu, décodage des appels d'outils, mise en forme des réponses, endpoint
`/api/voice/tools`, et deux outils métier réels (`check_availability`,
`get_business_information`).

**Ce qui attend le compte** : la conversation elle-même.

### Le contrat d'erreur, qui n'est pas intuitif

Une erreur métier se signale avec un **code HTTP 200** et un champ `error` dans le corps.
Un code d'erreur HTTP est compris par le fournisseur comme une panne de notre serveur : il
coupe la conversation. Avec un 200 et un message, Sophie peut dire au client qu'elle ne
peut pas répondre — sans raccrocher.

## Mode simulé

Chaque adaptateur aura une implémentation `mock`, utilisée quand `*_PROVIDER=mock`, et
**visiblement marquée** dans l'interface et dans les journaux.

Ce que le mode simulé ne fait jamais : prétendre qu'un SMS est parti, qu'un événement a
été créé, ou qu'un appel a eu lieu.

## Variables d'environnement

Toutes sont listées dans `.env.example`, groupées par phase, avec l'endroit où les placer.
Une variable manquante doit produire un message clair, pas un comportement dégradé
silencieux.
