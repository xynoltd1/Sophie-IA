# Architecture

## Vue d'ensemble

```
        Client final (téléphone)
                 │  appel entrant
                 ▼
      ┌────────────────────────┐
      │  Fournisseur téléphonie │  (webhooks signés)
      └───────────┬─────────────┘
                  │
                  ▼
      ┌────────────────────────┐        ┌──────────────────────┐
      │  Fournisseur Voice IA   │◄──────►│  SophieEngine        │
      │  (session média temps   │ outils │  (Route Handlers     │
      │   réel, hors Vercel)    │ métier │   Next.js sur Vercel)│
      └────────────────────────┘        └──────────┬───────────┘
                                                    │
                        ┌───────────────────────────┼────────────────────┐
                        ▼                           ▼                    ▼
              ┌──────────────────┐        ┌──────────────────┐  ┌────────────────┐
              │ Supabase Postgres│        │ Supabase Storage │  │ Google Calendar│
              │ + Auth + RLS     │        │ (audio, privé)   │  │ SMS, IA…       │
              └──────────────────┘        └──────────────────┘  └────────────────┘
                        ▲
                        │  RLS
              ┌──────────────────┐
              │ PWA Next.js      │  ← l'artisan, sur son téléphone
              └──────────────────┘
```

## Le point d'architecture le plus important

**Vercel ne peut pas héberger la session audio temps réel.** Les fonctions serverless
n'ont pas de processus permanent ni de socket média longue durée. La conversation vocale
se déroule donc entre le fournisseur de téléphonie et le fournisseur Voice IA ; notre
application n'est jamais dans le flux audio.

Notre rôle est celui du **cerveau métier** : le fournisseur Voice appelle nos Route
Handlers pour chaque outil (`check_availability`, `create_pending_appointment`, …). Ces
appels sont courts, authentifiés et idempotents. Ils sont parfaitement compatibles avec
le serverless.

Conséquence directe : `SophieEngine` est un ensemble d'endpoints HTTP, pas un service qui
tourne. Voir `docs/SOPHIE_AI.md`.

## Couches

| Couche | Emplacement | Rôle |
|---|---|---|
| Présentation | `src/app`, `src/components` | PWA mobile-first, états chargement/vide/erreur/succès |
| Session et autorisation | `src/lib/auth` | qui est connecté, dans quelle organisation, avec quel rôle |
| Accès données | `src/lib/supabase` | trois clients distincts (navigateur, serveur, admin) |
| Domaine | `src/lib/*` (par phase) | règles métier, indépendantes de tout fournisseur |
| Adaptateurs | `src/lib/providers/*` (Phases 3–6) | téléphonie, voix, messagerie, calendrier, IA |
| Persistance | `supabase/migrations` | schéma versionné, RLS, contraintes |

## Multi-tenant

`Organization` est l'entité centrale. Toute donnée métier porte un `organization_id`.

Trois barrières successives, dans cet ordre d'importance :

1. **RLS PostgreSQL** — la seule qui compte. Même si tout le code applicatif était
   contourné, une organisation ne peut pas lire les données d'une autre.
2. **Contrôle serveur** — `requireOrganization()` avant toute action ; l'identifiant
   d'organisation ne vient jamais du corps de la requête sans être revalidé.
3. **Interface** — masquer un bouton n'est jamais une sécurité, seulement du confort.

L'organisation active est mémorisée dans un cookie `sophie_org`, mais ce cookie n'accorde
aucun droit : sa valeur est systématiquement confrontée à `my_organizations()`, qui lit
la base sous RLS.

### Les trois clients Supabase

| Client | Fichier | Clé | Passe par RLS |
|---|---|---|---|
| Navigateur | `lib/supabase/client.ts` | `anon` | oui |
| Serveur (session utilisateur) | `lib/supabase/server.ts` | `anon` + cookies | oui |
| Administration | `lib/supabase/admin.ts` | `service_role` | **non** |

Le client d'administration importe `server-only` : la compilation échoue s'il est atteint
depuis un composant client. Son usage est réservé aux webhooks, aux traitements
asynchrones et à la console plateforme, et doit toujours être précédé d'un contrôle
d'autorisation explicite et suivi d'une écriture dans `audit_logs`.

## Adaptateurs externes

Chaque intégration passe par une interface définie côté domaine :

- `TelephonyProvider` — recevoir, transférer, enregistrer, raccrocher, métadonnées
- `VoiceAIProvider` — session vocale, outils exposés, transcription temps réel
- `MessagingProvider` — SMS aujourd'hui, WhatsApp et e-mail plus tard
- `CalendarProvider` — Google Calendar d'abord
- `AIProvider` — transcription, résumé, extraction structurée
- `StorageProvider` — audio dans un bucket privé, URL signées courtes

Chaque interface a au moins deux implémentations : la vraie et une implémentation `mock`
**visiblement marquée** dans l'interface et dans les journaux. Le domaine ne connaît
jamais le nom d'un fournisseur.

## Traitements asynchrones

Contrainte serverless : pas de worker permanent. Le modèle retenu est une table de jobs
en base, consommée par un endpoint protégé et déclenché par Vercel Cron.

```
CALL_COMPLETED
   → finaliser l'audio
   → transcrire
   → extraire
   → résumer
   → mettre à jour contact / lead
   → créer les tâches
   → notifier
```

Chaque étape est une ligne de job indépendante, avec statut, compteur de tentatives et
`correlation_id`. L'échec du résumé ne détruit ni l'audio ni la transcription. Détail en
Phase 5.

## Conventions de code

- TypeScript strict, `noUncheckedIndexedAccess` activé.
- Server Components par défaut ; `"use client"` seulement pour les formulaires et
  l'interactivité.
- Les mutations passent par des Server Actions ou des Route Handlers, jamais par un
  appel Supabase direct depuis le navigateur sur une donnée sensible.
- Toute nouvelle table portant un `organization_id` doit avoir RLS activé **et** une
  policy par opération, dans la même migration.

## Ce que 0.13.0 ajoute à l'architecture

### Un fournisseur d'IA pour l'après-appel, distinct du fournisseur de voix

`VoiceAIProvider` tient la conversation en direct. `AIProvider` lit une transcription déjà
enregistrée et en tire un résumé et des champs structurés. Les deux ne partagent rien, et
c'est voulu : le premier est dans le chemin critique de l'appel, le second non.

Le second existe parce que le premier s'est révélé incapable de tenir son propre réglage
d'analyse (ADR-031).

### Une file pour les messages sortants

Un SMS n'est pas un effet de bord d'une action : c'est une ligne dans `outbound_messages`,
avec ses tentatives, ses erreurs et son accusé de réception. L'action métier écrit la
décision, met le message en file, puis tente l'envoi. Les trois sont séparables, et c'est ce
qui permet de réessayer sans refaire la décision (ADR-032).

### Deux espaces, deux autorisations

```
/app     →  requireOrganization()   →  is_org_member()      →  RLS par organisation
/admin   →  requirePlatformAdmin()  →  is_platform_admin()   →  RLS par plateforme
/rdv     →  jeton                   →  fonction SQL a portee minimale
```

Les trois chemins ne se croisent jamais. Une faille dans l'un n'ouvre pas les autres.

### Les travaux planifiés, et pourquoi il n'y en a que deux

Un compte Hobby autorise deux tâches quotidiennes (ADR-024). `post-call` en regroupe donc
cinq : résumés manqués, purge audio, purge des rapports bruts, file des messages, libération
des créneaux bloqués. Chacune est isolée dans son `try` : l'échec de l'une n'empêche pas les
autres, et le compte rendu dit laquelle a échoué.

Le chemin normal reste le webhook de fin d'appel. Le travail planifié n'est qu'un filet.

## Le chemin de l'accueil téléphonique (0.20.0)

```
sonnerie
  └─ fournisseur vocal : « qui décroche sur ce numéro ? »   (assistant-request)
       └─ POST /api/voice/assistant
            ├─ verifyRequest()                      signature, avant toute lecture
            ├─ sophie_runtime_for_number(numéro)    1 aller-retour, security definer
            │    └─ rien → refus, jamais une autre organisation
            ├─ composerAccueil()                    pur ; garantit la mention d'IA
            ├─ buildAnnouncement()                  annonce légale, si elle est due
            └─ { assistantId, assistantOverrides }  on remplace les mots, pas les outils
```

Budget : **7,5 secondes**, imposé par le fournisseur, non configurable, au-delà
desquelles l'appel échoue chez un vrai client. C'est ce chiffre qui dicte la forme :
une seule fonction en base, aucun appel réseau sortant, aucune construction d'assistant.

`/api/voice/assistant` est distinct de `/api/voice/events` et de `/api/voice/tools`, et
les trois ont des contraintes différentes :

| Route | Quand | Contrainte |
|---|---|---|
| `assistant` | à la sonnerie | 7,5 s, sinon l'appel échoue |
| `tools` | pendant la conversation | une seconde de trop s'entend |
| `events` | après l'appel | peut prendre 60 s, personne n'écoute |
