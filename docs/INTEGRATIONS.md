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

## Mise à jour du 2026-11-02

`src/lib/providers/status.ts` reste la source de vérité. Ce qui suit la recopie.

| Intégration | État | Ce qui manque |
|---|---|---|
| Supabase | `TESTED` | — |
| Google Calendar | `TESTED` | validation de l'application Google (mode Test = autorisations révoquées à 7 jours, ADR-028) |
| Sophie Voice (Vapi) | `TESTED` | un numéro de téléphone ; la région européenne n'est pas en libre-service (ADR-026) |
| Transcription | `TESTED` | qualité française perfectible : noms propres et numéros dictés |
| Enregistrement conservé chez nous | `TESTED` | — |
| Résumé et extraction | `BLOCKED_EXTERNAL_CONFIG` | `AI_API_KEY` |
| SMS | `BLOCKED_EXTERNAL_CONFIG` | compte opérateur et numéro expéditeur |

### Ce que « écrit mais jamais exercé » veut dire ici

L'adaptateur SMS a été écrit contre la documentation de l'opérateur. Il gère la
signature des webhooks, l'idempotence, les codes de retour et la distinction entre erreur
reprenable et erreur définitive. **Aucun SMS n'est jamais parti.** Tant qu'un vrai message
n'est pas arrivé sur un vrai téléphone, cette intégration n'est pas testée, et le registre
le dit.

La même règle vaut pour le résumé : le code est exercé par des tests avec un fournisseur
simulé, jamais contre un vrai modèle.

### Canaux de conversation

| Canal | État |
|---|---|
| Téléphone | fonctionnel |
| SMS sortant | écrit, en attente de compte |
| SMS entrant | écrit, en attente de compte |
| WhatsApp | structure en base, aucun adaptateur |
| E-mail | structure en base, aucun adaptateur |
| Formulaire web | structure en base, aucun point d'entrée public |

Les trois derniers existent dans l'énumération des canaux et dans les tables. Il ne faut
pas en conclure qu'ils fonctionnent : rien ne les alimente.


## Google Search Console

**Statut** : implémenté, connexion réelle. Nécessite une portée à ajouter chez Google
(OWNER_ACTION_PLAN D3b).

| | |
|---|---|
| Portée OAuth | `https://www.googleapis.com/auth/webmasters.readonly` |
| Client OAuth | celui de l'agenda (`GOOGLE_OAUTH_CLIENT_ID` / `_SECRET`, ou la console) |
| Adresse de retour | `/api/integrations/search-console/callback` |
| Jeton durable | `access_type=offline` + `prompt=consent`, chiffré en base |
| Jeton d'accès | jamais stocké, redemandé à chaque besoin |
| Table | `search_console_connection`, une ligne, aucune permission de lecture |
| Garde | `requirePlatformAdmin` sur les deux routes |
| API lue | `GET /webmasters/v3/sites`, `POST .../searchAnalytics/query` |
| Module | `src/lib/seo/search-console.ts` |

**Portée volontairement limitée.** Lecture seule. L'application ne peut ni vérifier une
propriété, ni déposer un plan du site, ni modifier quoi que ce soit chez Google. Ces
gestes se font une fois à la main et demandent un accès DNS.

**Décalage de trois jours.** Google ne publie aucune donnée de recherche avant deux à
trois jours. La fenêtre interrogée s'arrête donc trois jours avant aujourd'hui.

**Mode dégradé.** Jeton refusé : l'erreur est écrite dans `last_error` et affichée sur
l'écran, avec l'invitation à reconnecter. Aucune valeur de repli n'est inventée — sans
connexion ou sans propriété, `performance()` rend `null` et l'écran dit pourquoi.

## Stockage des images publiques

**Statut** : implémenté.

Bucket `public-assets`, **public en lecture** — c'est voulu : une image de partage doit
être lisible par WhatsApp et LinkedIn, qui n'ont aucune session. Rien de sensible n'y
entre jamais. Les enregistrements d'appels restent dans leur bucket privé, inchangé.

| | |
|---|---|
| Types acceptés | `image/png`, `image/jpeg`, `image/webp` |
| Taille maximale | 2 Mo, imposée par le bucket **et** vérifiée côté serveur |
| Chemin | construit côté serveur : `partage/og-<horodatage>.<ext>` |
| Écriture | service role uniquement, via une action d'administration |

Le nom de fichier envoyé par le navigateur est ignoré. Un nom venant du client est une
adresse qu'il contrôle.
