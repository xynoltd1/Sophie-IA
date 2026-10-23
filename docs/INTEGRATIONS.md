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

## État au 2026-10-15

| Intégration | État | Ce qui manque |
|---|---|---|
| Supabase | `TESTED` | rien |
| Google Calendar | `TESTED` | validation Google avant d'ouvrir à des clients |
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

**Ce qui a été exercé contre Google, le 2026-10-15** : autorisation OAuth complète,
échange du code, chiffrement et stockage des jetons, synchronisation de l'agenda, puis
vérification par l'usage. Un événement réel de 10h à 11h placé dans l'agenda Google a
retiré les créneaux de 09:00 à 11:00 des disponibilités proposées par l'application, marge
de 15 minutes comprise. C'est cette dernière étape qui prouve l'intégration : la connexion
seule ne dit rien de ce que Sophie voit.

**Ce qui n'est pas encore exercé** : l'écriture d'un rendez-vous confirmé dans l'agenda
(`pushAppointment`), sa suppression à l'annulation, et le webhook de notification. Ces
chemins ne s'exécutent qu'à partir de la Phase 6.

**Ce qui reste avant d'ouvrir à des clients** : l'application Google est en mode **Test**.
Seules les adresses inscrites comme testeurs — 100 au maximum — peuvent connecter un
agenda. Un client réel ne le pourra pas. La validation de l'application par Google est un
prérequis de mise en production, listé dans `LEGAL_COMPLIANCE.md` ; elle exige notamment
une politique de confidentialité publiée et un domaine vérifié.

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

## Vapi — « Assistant credentials withheld »

Relevé dans les journaux d'un appel réel le 23 octobre 2026 :

```
Assistant credentials withheld from end-of-call-report: this server url came
from an assistant this request supplied, not from your org configuration
```

Ce message apparaît sur chaque message serveur (`status-update`,
`conversation-update`, `tool-calls`, `end-of-call-report`). Ce **n'est pas une erreur** :
toutes nos réponses sont à 200 et la chaîne fonctionne.

Ce qu'il signifie : l'adresse de notre serveur est déclarée **sur l'assistant** et non dans
les réglages de l'organisation Vapi. Dans ce cas, Vapi refuse d'y joindre les identifiants
stockés au niveau de l'organisation — un assistant fourni dans une requête ne doit pas
pouvoir se faire envoyer les secrets du compte. C'est une protection, et elle est saine.

L'authentification de nos webhooks ne dépend donc pas de ces identifiants : elle repose sur
l'en-tête `x-vapi-secret` configuré sur l'assistant lui-même, vérifié par
`VapiVoiceProvider.verifyRequest()`.

**À ne pas confondre avec une panne.** Une session future qui lira ces journaux pourrait
conclure à un problème d'authentification et changer quelque chose qui marche.

## Vapi — forme du rapport de fin d'appel

Les messages de la conversation ont cette forme, relevée sur un appel réel :

```json
{ "role": "bot", "time": 1792686980000, "endTime": 1792686983500,
  "message": "Bonjour, ici Sophie.", "secondsFromStart": 1.88 }
```

`role` vaut `system`, `bot`, `user`, `tool_calls` ou `tool_call_result`. Seuls `bot` et
`user` sont conservés dans la transcription : l'instruction de départ est le prompt complet
de Sophie, inutile à l'artisan et volumineux à chaque appel.

`secondsFromStart` est relatif au début de l'appel ; `time` et `endTime` sont des instants
absolus. Ne jamais additionner les deux natures — c'est la raison du calcul en deux temps
dans `src/lib/calls/report.ts`.

Les emplacements du résumé et de l'URL d'enregistrement n'ont pas encore été observés sur
un rapport réel. Le code les cherche à plusieurs endroits connus et conserve le rapport
brut dans `call_events` pour pouvoir corriger sans rien redemander au fournisseur.
