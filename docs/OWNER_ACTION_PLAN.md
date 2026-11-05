# Ce que Zehra doit faire, étape par étape

> **Version du code auditée : 0.15.0** · Rédigé le 2026-11-02
>
> Ce document est fait pour être repris plusieurs jours plus tard. Cochez une case quand
> c'est fini. Le tableau récapitulatif, en bas, montre où vous en êtes d'un coup d'œil.
>
> Chaque action dit qui la fait : `JE DOIS FAIRE` (vous), `CLAUDE PEUT FAIRE` (moi),
> `ACTION PARTAGÉE` (je prépare, vous collez), `DÉJÀ FAIT ET VÉRIFIÉ`.
>
> **Je ne vous demanderai jamais de coller une clé secrète dans la conversation.** Les clés
> vont directement dans les variables d'environnement.

---

## Ce que l'audit du code a trouvé

J'ai relu le projet livré avant d'écrire ce plan : les 30 migrations, `.env.example`,
`DEPLOYMENT.md`, `CLAUDE_HANDOFF.md`, `vercel.json`, les 14 routes d'API et le registre
`src/lib/providers/status.ts`.

**Trois écarts entre la documentation et le code.** Je les signale ici et je corrige les
documents dans la même livraison.

1. `DEPLOYMENT.md` annonce un webhook de téléphonie sur
   `https://zelicall.com/api/webhooks/telephony`. **Cette route n'existe pas.** Les vraies
   routes sont `/api/voice/events`, `/api/voice/tools`, `/api/messaging/inbound` et
   `/api/messaging/status`. Déclarer la mauvaise URL chez un fournisseur donne des webhooks
   qui tombent dans le vide, sans erreur visible.
2. `DEPLOYMENT.md` annonce **une** tâche planifiée. `vercel.json` en déclare **deux** :
   `/api/jobs/calendar-sync` à 4 h 00 et `/api/jobs/post-call` à 4 h 40.
3. `status.ts` dit « seize migrations appliquées ». Il y en a trente.

**Un point important sur la téléphonie.** `src/lib/providers/telephony/` ne contient qu'un
fichier de types : **aucun adaptateur opérateur n'est écrit**. Ce n'est pas un oubli, c'est
la conséquence de l'architecture (ADR-002) : le son de l'appel ne passe jamais par notre
application. C'est Vapi qui reçoit l'appel et nous envoie des événements. Donc **pour
recevoir un appel, vous n'avez pas besoin d'un adaptateur Twilio** — vous avez besoin d'un
numéro rattaché à votre assistant Vapi. Twilio ne sert qu'aux SMS, et là l'adaptateur
existe.

**Les 14 routes d'API réelles** (c'est la liste qui compte pour les URL à déclarer) :

| Route | À qui elle sert | Protection |
|---|---|---|
| `/api/voice/tools` | Vapi, pendant l'appel | signature HMAC `VOICE_WEBHOOK_SECRET` |
| `/api/voice/events` | Vapi, après l'appel | même signature |
| `/api/voice/tools/manifest` | déclaration des outils | lecture seule |
| `/api/messaging/inbound` | SMS reçu | signature de l'opérateur |
| `/api/messaging/status` | accusé de réception SMS | signature de l'opérateur |
| `/api/integrations/google/start` | vous, pour connecter l'agenda | session utilisateur |
| `/api/integrations/google/callback` | Google, après autorisation | état signé |
| `/api/integrations/google/notify` | Google, quand l'agenda change | jeton du canal |
| `/api/jobs/calendar-sync` | tâche planifiée Vercel | `CRON_SECRET` |
| `/api/jobs/post-call` | tâche planifiée Vercel | `CRON_SECRET` |
| `/api/calls/[id]/audio` | vous, pour écouter | session + organisation |
| `/api/calls/[id]/summary` | vous, pour réessayer un résumé | session + organisation |
| `/api/health`, `/api/health/supabase` | vous, pour vérifier | aucune |

---

# A — À faire maintenant

**But : la version 0.15.0 est en ligne, et vous avez la preuve qu'elle marche.**
Rien ici ne coûte d'argent. Comptez deux à trois heures.

## A1 — Mettre le code sur GitHub

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute** · aucune dépendance · **coût : 0 €** (dépôt privé
gratuit)

**Quoi** Créer un dépôt privé, y mettre le contenu du ZIP, pousser.

**Pourquoi** Vercel déploie depuis GitHub. Sans dépôt, chaque mise en ligne se fait à la
main et vous perdez l'historique. C'est aussi votre sauvegarde du code.

**Site** `https://github.com`

**Les menus** En haut à droite, le `+` → *New repository*. Nom : `sophie-ia`. Cochez
**Private**. Ne cochez ni README, ni .gitignore, ni licence — ils sont déjà dans le ZIP.
*Create repository*.

**Valeurs à saisir** Rien d'autre que le nom.

**Variables d'environnement** Aucune.

**Résultat attendu** Une page de dépôt vide, avec des instructions `git`.

**Comment vérifier** Après le `push`, la page du dépôt montre les dossiers `src`, `docs`,
`supabase`, et **pas** de fichier `.env.local`.

**Si ça échoue**
- « Permission denied (publickey) » : vous n'avez pas de clé SSH. Utilisez l'URL en
  `https://` au lieu de `git@github.com`, GitHub vous demandera alors un mot de passe
  d'application.
- « Repository not found » : le nom du dépôt dans la commande ne correspond pas. Recopiez
  l'URL depuis la page GitHub.
- Si vous voyez un fichier `.env` ou `.env.local` sur GitHub : **arrêtez tout et
  dites-le-moi.** Il faudra changer toutes les clés.

Les commandes, à coller une par une :

**TERMINAL** (dans le dossier où vous avez décompressé le ZIP)

```
git init
git add .
git commit -m "Sophie IA 0.15.0"
git branch -M main
```

**TERMINAL** (remplacez `VOTRE-COMPTE` par votre nom d'utilisateur GitHub)

```
git remote add origin https://github.com/VOTRE-COMPTE/sophie-ia.git
git push -u origin main
```

## A2 — Appliquer les migrations 0025 à 0030

- [ ] Fait
`ACTION PARTAGÉE` · priorité **haute, bloquante** · dépend de : rien · **coût : 0 €**

**Quoi** Coller six fichiers SQL, dans l'ordre, dans l'éditeur SQL de Supabase.

**Pourquoi** Le code de la 0.15.0 attend des tables et des colonnes qui n'existent pas
encore dans votre base. Sans ces six migrations, plusieurs écrans affichent une erreur :
les réglages de conservation, la ligne téléphonique, les tâches, l'espace
d'administration.

**Site** `https://supabase.com/dashboard` → votre projet Sophie IA

**Les menus** Barre de gauche → **SQL Editor** → *New query*.

**Valeurs à saisir** Le contenu de chaque fichier, dans cet ordre strict :

```
supabase/migrations/20261102100000_0025_summary_pipeline.sql
supabase/migrations/20261102110000_0026_appointment_workflow.sql
supabase/migrations/20261102120000_0027_platform_admin.sql
supabase/migrations/20261102130000_0028_conversations.sql
supabase/migrations/20261102140000_0029_calls_management.sql
supabase/migrations/20261102150000_0030_retention_and_lines.sql
```

L'ordre compte : la 0030 ajoute des colonnes à des tables créées par la 0029.

**Variables d'environnement** Aucune.

**Résultat attendu** Pour chacune : *Success. No rows returned*.

**Comment vérifier** Collez ceci après les six :

**SQL EDITOR SUPABASE**

```sql
select count(*) as tables_attendues
from information_schema.tables
where table_schema = 'public'
  and table_name in ('retention_runs','outbound_messages','notifications',
                     'plans','subscriptions','usage_records','provider_errors',
                     'conversations','conversation_messages');
```

Le résultat doit être **9**. Moins que 9 : une migration n'est pas passée.

**Si ça échoue**
- `relation ... already exists` : cette migration est déjà appliquée. Passez à la suivante,
  ce n'est pas une erreur.
- `relation ... does not exist` : vous avez sauté une migration ou changé l'ordre.
  Reprenez à la 0025.
- `permission denied` : vous n'êtes pas sur le bon projet, ou pas propriétaire.

## A3 — Vérifier que la base est saine

- [ ] Fait
`ACTION PARTAGÉE` · priorité haute · dépend de **A2** · **coût : 0 €**

**Quoi** Lancer les deux fichiers de contrôle livrés avec le projet, puis l'analyseur de
sécurité de Supabase.

**Pourquoi** Une table sans règle d'isolation (`RLS`) laisse une entreprise voir les
données d'une autre. C'est l'erreur la plus grave possible dans ce produit, et elle ne
provoque aucun message d'erreur : tout a l'air de fonctionner.

**Site** `https://supabase.com/dashboard`

**Les menus**
1. **SQL Editor** → collez `supabase/checks/01_verify_schema.sql`, puis
   `02_verify_content.sql`.
2. Barre de gauche → **Advisors** → onglet **Security**.

**Résultat attendu** Les deux fichiers de contrôle passent. Dans Advisors → Security :
**aucune ligne « RLS disabled in public »**.

**Comment vérifier** En plus, collez ceci :

**SQL EDITOR SUPABASE**

```sql
select tablename
from pg_tables
where schemaname = 'public'
  and not rowsecurity
order by tablename;
```

Ce résultat doit être **vide**. Chaque ligne affichée est une table ouverte à tous.

**Si ça échoue** Envoyez-moi la liste des tables affichées. J'écris la migration qui
rétablit la protection — c'est mon travail, pas le vôtre.

## A4 — Vérifier que le dossier des enregistrements est privé

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute** · dépend de **A2** · **coût : 0 €**

**Quoi** Vérifier que le bucket `call-recordings` existe et qu'il est privé.

**Pourquoi** Ce dossier contient la voix de vos clients. S'il est public, n'importe qui
avec l'adresse du fichier peut écouter un appel, sans compte et sans trace.

**Site** `https://supabase.com/dashboard` → **Storage**

**Les menus** Barre de gauche → **Storage**. Le bucket `call-recordings` doit apparaître
**sans** l'étiquette *Public*.

**Résultat attendu** Un bucket privé, probablement vide pour l'instant.

**Comment vérifier**

**SQL EDITOR SUPABASE**

```sql
select id, public from storage.buckets where id = 'call-recordings';
```

`public` doit valoir `false`.

**Si ça échoue** Si `public` vaut `true`, dites-le-moi. Si le bucket n'existe pas du tout,
c'est la migration 0024 qui n'est pas passée.

## A5 — Préparer les trois secrets de l'application

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute** · dépend de : rien · **coût : 0 €**

**Quoi** Générer trois secrets au hasard. Ce ne sont pas des mots de passe à retenir : ce
sont des suites de caractères que seul votre serveur connaît.

**Pourquoi**
- `SECRETS_ENCRYPTION_KEY` chiffre les jetons d'agenda Google avant de les écrire en base.
  Sans elle, un vol de base donne accès aux agendas de vos clients. **Si vous la changez
  plus tard, tous vos clients devront reconnecter leur agenda.**
- `CRON_SECRET` empêche n'importe qui de déclencher vos tâches planifiées, donc de
  déclencher une purge.
- `VOICE_WEBHOOK_SECRET` signe les messages de Vapi. Sans elle, n'importe qui peut
  prétendre être Vapi et créer de faux appels dans votre base.

**Site** Aucun. C'est une commande sur votre ordinateur.

**Valeurs à saisir** Lancez la commande trois fois et gardez les trois résultats dans un
gestionnaire de mots de passe — **pas dans un fichier texte sur le bureau, et pas dans
cette conversation**.

**TERMINAL**

```
openssl rand -base64 32
```

Sur Windows sans `openssl`, utilisez PowerShell :

**TERMINAL**

```
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Variables d'environnement** `SECRETS_ENCRYPTION_KEY`, `CRON_SECRET`,
`VOICE_WEBHOOK_SECRET`.

**Où les placer** Dans Vercel (étape A6) **et** dans votre fichier `.env.local` sur votre
ordinateur, avec **exactement la même valeur** pour `SECRETS_ENCRYPTION_KEY`. Si les deux
diffèrent, un agenda connecté en local devient illisible en production.

**Résultat attendu** Trois suites de 44 caractères, différentes.

**Comment vérifier** Chaque valeur fait 44 caractères et finit souvent par `=`.

**Si ça échoue** `openssl: command not found` → utilisez la version PowerShell.

## A6 — Renseigner les variables d'environnement sur Vercel

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute, bloquante** · dépend de **A1**, **A5** · **coût : 0 €**

**Quoi** Ajouter ou vérifier huit variables.

**Pourquoi** L'application lit ces valeurs au démarrage. Il en manque une, et l'écran
concerné tombe en panne — parfois sans message clair.

**Site** `https://vercel.com`

**Les menus** Votre projet → **Settings** → **Environment Variables**.

**Valeurs à saisir**

| Nom exact | Type | Valeur | Environnements |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Config | depuis Supabase → Settings → API | tous |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Config | depuis Supabase → Settings → API | tous |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | depuis Supabase → Settings → API | tous |
| `SECRETS_ENCRYPTION_KEY` | **Secret** | votre secret 1 (A5) | tous |
| `CRON_SECRET` | **Secret** | votre secret 2 (A5) | tous |
| `NEXT_PUBLIC_APP_URL` | Config | `https://zelicall.com` | Production |
| `NEXT_PUBLIC_APP_ENV` | Config | `production` | Production |
| `AI_PROVIDER` | Config | `mock` pour l'instant | tous |

**Deux règles à ne jamais enfreindre.**
- `SUPABASE_SERVICE_ROLE_KEY` ne porte **jamais** le préfixe `NEXT_PUBLIC_`. Cette clé
  contourne toutes les protections ; préfixée, elle partirait dans le navigateur de chaque
  visiteur.
- `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY` et `SUPABASE_TEST_SERVICE_ROLE_KEY` ne
  vont **jamais** sur Vercel. Elles servent aux tests sur votre ordinateur seulement.

**Résultat attendu** Huit lignes dans la page, les secrets masqués.

**Comment vérifier** Sur votre ordinateur, dans le dossier du projet :

**TERMINAL**

```
npm run check:env
```

Cette commande dit ce qui manque **sans afficher aucune valeur**.

**Si ça échoue** Les variables `NEXT_PUBLIC_` sont lues **au moment de la compilation**.
Si vous les ajoutez après un déploiement, relancez un déploiement, sinon rien ne change.

## A7 — Déployer et vérifier que le site répond

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute** · dépend de **A1**, **A2**, **A6** · **coût : 0 €**
(plan Hobby ; Pro ≈ 20 $/mois — prix connu, à reconfirmer sur la page tarifs)

**Quoi** Relier le dépôt GitHub à Vercel et lancer le premier déploiement.

**Pourquoi** C'est la mise en ligne. Et c'est l'étape qui a déjà échoué une fois sur ce
projet alors que tous les tests passaient : Vercel a refusé la version 0.5.1 à cause d'une
tâche planifiée trop fréquente, **avant même de compiler**.

**Site** `https://vercel.com`

**Les menus** *Add New* → *Project* → *Import Git Repository* → choisissez `sophie-ia`.
Laissez le cadre détecter Next.js. Ne touchez pas aux commandes de build. *Deploy*.

**Variables d'environnement** Celles de A6 doivent déjà être là.

**Résultat attendu** Un déploiement vert, et une adresse en `.vercel.app`.

**Comment vérifier** Ouvrez ces deux adresses dans votre navigateur :

```
https://VOTRE-PROJET.vercel.app/api/health
https://VOTRE-PROJET.vercel.app/api/health/supabase
```

La première doit répondre un petit texte JSON. La seconde doit dire que la base répond.
Ensuite, ouvrez la page d'accueil et connectez-vous.

**Si ça échoue**
- « Hobby accounts are limited to daily cron jobs » : une tâche de `vercel.json` est trop
  fréquente. Les deux livrées sont quotidiennes, donc ce message ne devrait pas apparaître.
- « Error occurred prerendering page » : une page essaie de lire la base pendant la
  compilation. Envoyez-moi le nom de la page.
- Taux d'erreur à 100 % avec un déploiement vert : il manque une variable
  d'environnement. Regardez *Deployments → le déploiement → Runtime Logs*.

## A8 — Créer votre compte super administrateur

- [ ] Fait
`ACTION PARTAGÉE` · priorité moyenne · dépend de **A2**, **A7** · **coût : 0 €**

**Quoi** Marquer votre compte comme administrateur de la plateforme.

**Pourquoi** L'espace `/admin` est écrit en entier mais inaccessible : aucun compte n'a le
droit. C'est là que vous verrez la santé du système, les erreurs des fournisseurs, le
journal des purges, les métiers et les offres.

**Site** `https://supabase.com/dashboard` → **SQL Editor**

**Valeurs à saisir** Remplacez l'adresse par la vôtre.

**SQL EDITOR SUPABASE**

```sql
update public.profiles
set is_platform_admin = true
where id = (select id from auth.users where email = 'votre-adresse@exemple.com');
```

**Résultat attendu** *Success. 1 row*.

**Comment vérifier** Déconnectez-vous, reconnectez-vous, ouvrez
`https://VOTRE-PROJET.vercel.app/admin`. Vous devez voir l'espace plateforme, pas une
redirection.

**Si ça échoue** *0 rows* → l'adresse ne correspond à aucun compte. Créez d'abord votre
compte dans l'application, puis relancez.

## A9 — Exempter les webhooks de la protection Vercel

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute, piège classique** · dépend de **A7** · **coût : 0 €**

**Quoi** Autoriser Vapi et l'opérateur SMS à appeler nos routes sans passer par une page
de connexion.

**Pourquoi** Vercel protège les déploiements par défaut. Un fournisseur qui appelle
`/api/voice/tools` reçoit alors **une page de connexion HTML** à la place de notre réponse.
Pendant un appel, Sophie se retrouve sans outils : elle ne peut plus consulter l'agenda ni
créer un contact, et elle improvise. Rien dans nos journaux ne le montre, parce que la
requête n'arrive jamais jusqu'à nous.

**Site** `https://vercel.com`

**Les menus** Votre projet → **Settings** → **Deployment Protection**. Si *Vercel
Authentication* est activée sur la production, ajoutez une exception dans
*Protection Bypass* ou désactivez la protection sur Production. (Le nom exact de ce réglage
change parfois ; cherchez « Protection » dans les réglages.)

**Routes à exempter** `/api/voice/*`, `/api/messaging/*`, `/api/integrations/google/*`,
`/api/health*`.

**Résultat attendu** Un appel de l'extérieur à `/api/health` répond du JSON, pas du HTML.

**Comment vérifier**

**TERMINAL**

```
curl -i https://zelicall.com/api/health
```

Vous devez voir `200` et du JSON. Si vous voyez `401` ou du HTML avec le mot
« Authentication », la protection bloque encore.

**Si ça échoue** La protection peut être réglée par environnement. Vérifiez que vous l'avez
bien changée pour **Production**, pas seulement pour les aperçus.

## A10 — Relier le domaine zelicall.com

- [ ] Fait
`JE DOIS FAIRE` · priorité moyenne · dépend de **A7** · **coût : 0 €** (domaine déjà
acheté)

**Quoi** Pointer `zelicall.com` vers Vercel.

**Pourquoi** Toutes les URL à déclarer chez Google, Vapi et l'opérateur contiennent ce
domaine. Les déclarer avec l'adresse `.vercel.app` vous obligerait à tout refaire ensuite —
et une URL de rappel OAuth qui change d'un seul caractère casse la connexion des agendas.

**Site** `https://vercel.com` puis le site où vous avez acheté le domaine.

**Les menus** Projet → **Settings** → **Domains** → *Add* → `zelicall.com`. Vercel affiche
les enregistrements DNS à créer. Copiez-les chez votre registrar.

**Valeurs à saisir** Celles que Vercel affiche. Ne les inventez pas : elles dépendent du
projet.

**Variables à mettre à jour ensuite** `NEXT_PUBLIC_APP_URL` = `https://zelicall.com`, puis
**relancez un déploiement** (variable lue à la compilation).

**Résultat attendu** `https://zelicall.com` affiche votre application, en HTTPS.

**Comment vérifier** Ouvrez `https://zelicall.com/api/health`. Le certificat doit être
valide (cadenas fermé).

**Si ça échoue** Les DNS mettent de quelques minutes à 24 heures. « Invalid Configuration »
dans Vercel signifie que l'enregistrement n'est pas encore visible — attendez, ne changez
rien deux fois.

## A11 — Vérifier les deux tâches planifiées

- [ ] Fait
`JE DOIS FAIRE` · priorité moyenne · dépend de **A6**, **A7** · **coût : 0 €**

**Quoi** Vérifier que Vercel exécute bien les deux tâches quotidiennes.

**Pourquoi** Elles font tout ce qui ne peut pas attendre un clic : rattraper les agendas en
retard, libérer les créneaux bloqués, envoyer les SMS en attente, produire les résumés
manquants, **et lancer les six purges de conservation**. Si elles ne tournent pas, rien ne
s'efface jamais — et c'est exactement ce qu'un contrôle de données reproche.

**Site** `https://vercel.com`

**Les menus** Projet → onglet ou section **Cron Jobs**. Vous devez voir :

| Chemin | Heure |
|---|---|
| `/api/jobs/calendar-sync` | 4 h 00 |
| `/api/jobs/post-call` | 4 h 40 |

**Résultat attendu** Les deux apparaissent, avec des exécutions réussies après la première
nuit.

**Comment vérifier** Le lendemain, ouvrez `/admin` → **Santé**. La section *Purges de
conservation* doit montrer au moins une ligne. « Aucune purge consignée » après deux nuits
veut dire que la tâche ne tourne pas, ou que `CRON_SECRET` manque.

**Si ça échoue**
- Pas de tâche affichée : le déploiement est antérieur à l'ajout de `vercel.json`. Relancez
  un déploiement.
- Exécutions en erreur 401 : `CRON_SECRET` n'est pas défini sur Vercel.
- Sur le plan Hobby, l'heure est respectée à **une heure près**. Ce n'est pas une panne.

## A12 — Vérifier les sauvegardes de la base

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute** · dépend de **A2** · **coût : 0 €** sur le plan
gratuit, mais **sauvegardes limitées**

**Quoi** Regarder quelles sauvegardes votre plan Supabase fait réellement.

**Pourquoi** Le plan gratuit ne garantit pas de restauration à un instant précis. Le jour
où une migration efface quelque chose, c'est la seule chose qui compte. Vous n'avez pas
encore de clients : c'est le bon moment pour le savoir, pas dans six mois.

**Site** `https://supabase.com/dashboard`

**Les menus** Projet → **Database** → **Backups**.

**Résultat attendu** Vous savez si vous avez des sauvegardes quotidiennes et combien de
jours elles remontent.

**Comment vérifier** La page le dit. Notez la réponse ici :
`sauvegardes : ______ jours`.

**Si ça échoue** Pas de sauvegarde = le passage au plan Pro (≈ 25 $/mois, prix connu, à
reconfirmer) devient nécessaire **avant le premier client payant**, pas avant.

## A13 — Régler vos durées de conservation

- [ ] Fait
`JE DOIS FAIRE` · priorité moyenne · dépend de **A2**, **A7** · **coût : 0 €**

**Quoi** Choisir vos trois durées dans l'application.

**Pourquoi** Les valeurs par défaut sont d'un an. Ce chiffre est un choix technique de ma
part, **pas un avis juridique**. Il faudra le faire valider (étape C3), mais en attendant
vous devez savoir ce que vous gardez.

**Site** Votre application.

**Les menus** `/app/reglages` → **Conservation des données**. Et
`/app/sophie/enregistrement` pour l'audio (30 jours maximum, imposé en base).

**Résultat attendu** Trois durées enregistrées, et le message « Durées de conservation
enregistrées ».

**Comment vérifier**

**SQL EDITOR SUPABASE**

```sql
select name, transcript_retention_days, summary_retention_days,
       message_retention_days, audio_retention_days
from public.organizations;
```

**Si ça échoue** Si l'écran dit que le réglage n'a pas pu être enregistré, la migration
0030 n'est pas appliquée.

---

# B — Pour tester Sophie avec de vrais appels

**But : un vrai téléphone appelle, Sophie répond, et tout arrive dans l'application.**
C'est ici que les premiers euros sortent. Comptez 30 à 60 € pour tout vérifier.

## B1 — Google Cloud : créer l'identifiant OAuth

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute** · dépend de **A10** · **coût : 0 €**

**Quoi** Créer un identifiant OAuth « Application Web » et activer l'API Calendar.

**Pourquoi** Sans cela, aucun professionnel ne peut connecter son agenda, donc Sophie ne
connaît aucune disponibilité réelle — et elle a l'interdiction d'en inventer. Elle ne
pourrait que prendre un message.

**Site** `https://console.cloud.google.com`

**Les menus**
1. En haut, créez un projet nommé `Sophie IA`.
2. **APIs & Services** → **Library** → cherchez *Google Calendar API* → *Enable*.
3. **APIs & Services** → **OAuth consent screen** : type *External*, nom de
   l'application `Sophie IA`, votre e-mail d'assistance, le domaine `zelicall.com`.
4. **Audience** (ou *Test users* selon la version de l'interface) → ajoutez votre adresse
   comme testeur.
5. **APIs & Services** → **Credentials** → *Create Credentials* → *OAuth client ID* →
   type **Web application**.

**Valeurs à saisir** Dans *Authorized redirect URIs*, ajoutez ces deux lignes, **exactement**
(un slash en trop casse tout) :

```
https://zelicall.com/api/integrations/google/callback
http://localhost:3000/api/integrations/google/callback
```

Permissions demandées : uniquement l'agenda. Ne demandez pas plus : chaque permission
supplémentaire rallonge la validation de l'étape C1.

**Variables d'environnement** `GOOGLE_OAUTH_CLIENT_ID`,
`GOOGLE_OAUTH_CLIENT_SECRET` (type **Secret**),
`GOOGLE_OAUTH_REDIRECT_URI` = `https://zelicall.com/api/integrations/google/callback`.

**Où** Vercel → Settings → Environment Variables. Puis **relancez un déploiement**.

**Résultat attendu** Un identifiant client et un secret affichés une seule fois.

**Comment vérifier** Étape B2.

**Si ça échoue** « Error 400: redirect_uri_mismatch » → l'URI de la console et la variable
ne sont pas identiques au caractère près. Comparez-les côte à côte.

## B2 — Connecter votre agenda et vérifier qu'il bloque des créneaux

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute** · dépend de **B1** · **coût : 0 €**

**Quoi** Connecter votre propre agenda, y créer un événement, et vérifier que Sophie ne
propose plus ce créneau.

**Pourquoi** C'est la seule preuve que la chaîne complète fonctionne : autorisation,
chiffrement du jeton, synchronisation, calcul des disponibilités.

**Les menus** Application → `/app/plus` → section **Agenda** → *Connecter mon agenda*.

**Résultat attendu** La page dit que l'agenda est connecté et donne une heure de
synchronisation.

**Comment vérifier** Dans votre Google Agenda, créez un événement demain de 10 h à 11 h.
Puis dans l'application, ouvrez `/app/agenda` : les créneaux de **9 h 00 à 11 h 00**
doivent avoir disparu des propositions — 9 h à cause de la marge de 15 minutes entre
interventions.

**Si ça échoue**
- « Autorisation Google expirée » au bout de 7 jours : c'est normal tant que l'application
  est en mode Test. Reconnectez. La solution définitive est l'étape C1.
- L'événement n'est pas pris en compte : vérifiez que c'est bien l'agenda principal du
  compte connecté.

## B3 — Fournisseur d'IA : arrêter les résumés simulés

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute** · dépend de **A6** · **coût ≈ 1 à 5 € par mois** au
début (estimation)

**Quoi** Ouvrir un compte Mistral, créer une clé, la mettre dans Vercel.

**Pourquoi** Aujourd'hui `AI_PROVIDER=mock` : l'application affiche un résumé **simulé** et
le dit clairement sur la fiche d'appel. Ce n'est pas un bug, c'est le refus d'inventer. Avec
une vraie clé, le résumé et les données extraites (nom, adresse, problème, date souhaitée)
deviennent réels.

**Pourquoi Mistral plutôt qu'un autre** Une transcription d'appel contient le nom, l'adresse
et le problème d'un client. Mistral est européen : les données ne quittent pas l'Europe. Cela
simplifie beaucoup l'étape C2.

**Site** `https://console.mistral.ai`

**Les menus** Créez un compte → **API Keys** → *Create new key*. Ajoutez un moyen de
paiement avec une limite basse.

**Variables d'environnement** (toutes dans Vercel)

```
AI_PROVIDER=mistral
AI_BASE_URL=https://api.mistral.ai/v1
AI_MODEL=mistral-small-latest
AI_API_KEY=<votre clé, type Secret>
```

**Coût** Facturé au nombre de mots traités. Un résumé d'appel de trois minutes coûte une
fraction de centime. **Estimation**, à vérifier sur la page tarifs de Mistral.

**Résultat attendu** Sur une fiche d'appel, le résumé n'est plus marqué comme simulé.

**Comment vérifier** Ouvrez un appel existant → bouton *Réessayer le résumé*. Puis :

**SQL EDITOR SUPABASE**

```sql
select summary_source, summary_status, left(summary, 80) as debut
from public.calls
order by started_at desc limit 5;
```

`summary_source` doit afficher `mistral:mistral-small-latest`, pas `MOCK`.

**Si ça échoue** `/admin` → **Santé** → *Erreurs des fournisseurs* affichera la ligne
`AI · genererIntelligenceAppel` avec le message exact renvoyé par Mistral.

## B4 — Vapi : le compte, l'assistant et les outils

- [ ] Fait
`ACTION PARTAGÉE` · priorité **haute** · dépend de **A9**, **A10** · **coût : 10 $ offerts**,
puis **0,05 $/minute de frais de plateforme** (vérifié) **+ reconnaissance vocale, modèle et
voix**, soit **environ 0,10 à 0,20 $/minute au total** (estimation)

**Quoi** Créer le compte, créer l'assistant, déclarer nos quatorze outils, régler la
signature des webhooks.

**Pourquoi** Vapi est ce qui parle au téléphone. Notre application ne reçoit jamais le son :
elle lui fournit des outils (consulter les disponibilités, créer un contact, bloquer un
créneau) et reçoit les événements après l'appel. C'est la décision d'architecture la plus
structurante du projet (ADR-002).

**Site** `https://vapi.ai`

**Les menus**
1. Créez le compte. **Votre compte sera en région américaine** : la région européenne n'est
   pas accessible en libre-service, elle est réservée aux contrats Premier (ADR-026). C'est
   un point à déclarer dans vos documents de confidentialité (étape C2).
2. **API Keys** → créez une clé privée.
3. **Assistants** → *Create Assistant*. Langue : français. Modèle et voix : à choisir
   ensemble, j'ai des recommandations.
4. **Settings** → *Server URL* (ou l'onglet Webhooks) : `https://zelicall.com/api/voice/events`.
   Authentification : **HMAC SHA-256**, avec votre `VOICE_WEBHOOK_SECRET`. Activez l'en-tête
   d'horodatage.

**Variables d'environnement** (Vercel)

```
VOICE_PROVIDER=vapi
VOICE_API_BASE_URL=https://api.vapi.ai
VOICE_API_KEY=<clé Vapi, type Secret>
VOICE_WEBHOOK_SECRET=<votre secret 3 de l'étape A5, type Secret>
```

Et sur **votre ordinateur seulement**, dans `.env.local` (jamais sur Vercel) :

```
SOPHIE_ORG_ID=<l'identifiant de votre organisation>
VOICE_ASSISTANT_ID=<l'identifiant de l'assistant Vapi>
```

Pour trouver `SOPHIE_ORG_ID` :

**SQL EDITOR SUPABASE**

```sql
select id, name from public.organizations;
```

**Déclarer les outils** Une fois `.env.local` rempli :

**TERMINAL**

```
npm run vapi:tools -- --apply
```

**Résultat attendu** Le script affiche les outils créés et les rattache à l'assistant.

**Comment vérifier** Dans Vapi → **Tools**, les outils apparaissent, tous pointant vers
`https://zelicall.com/api/voice/tools`.

**Si ça échoue**
- Clé refusée : votre clé est américaine et `VOICE_API_BASE_URL` est européenne, ou
  l'inverse. Les deux doivent correspondre.
- **Piège vérifié le 23 octobre** : si vous modifiez l'assistant **dans le tableau de bord
  Vapi** après avoir lancé le script, le tableau de bord **écrase** ce que le script a
  poussé. Relancez le script après chaque modification faite à la main.
- Les outils existent mais Sophie ne les appelle pas : vérifiez que l'assistant utilisé
  pendant l'appel est bien celui auquel les outils sont rattachés.

## B5 — Obtenir un numéro de téléphone

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute, c'est le vrai blocage** · dépend de **B4** ·
**coût : voir les trois options**

**Quoi** Obtenir un numéro que Vapi peut faire sonner.

**Pourquoi** C'est la seule chose qui manque pour tout vérifier. Sans numéro, chaque appel
tombe dans le repli « essai » et rien ne peut être prouvé de bout en bout.

**Trois options, dans l'ordre que je recommande.**

### Option 1 — Un numéro américain chez Vapi, pour tester tout de suite

Vapi vend des numéros américains directement depuis son tableau de bord, sans justificatif.
**Coût : environ 2 $ par mois** (estimation, à vérifier sur la page *Phone Numbers* de
Vapi).

- **Menus** Vapi → **Phone Numbers** → *Buy Number* → pays États-Unis → rattachez-le à
  votre assistant.
- **Pourquoi commencer par là** Vous vérifiez la chaîne complète cette semaine, pour deux
  dollars, sans attendre de dossier. Vos clients belges ne verront jamais ce numéro : il ne
  sert qu'à vous.
- **Limite** Appeler un numéro américain depuis la Belgique coûte cher **à vous**, selon
  votre forfait mobile. Comptez quelques appels courts, pas une heure d'essais.

### Option 2 — Un numéro belge ou français chez Twilio, puis importé dans Vapi

C'est l'option pour de vrais clients.

- **Site** `https://console.twilio.com`
- **Menus** **Phone Numbers** → **Manage** → *Buy a number* → pays Belgique. Puis
  **Regulatory Compliance** → **Bundles** pour déposer les justificatifs.
- **Documents nécessaires** La Belgique et la France exigent une preuve d'identité et une
  **preuve d'adresse de l'entreprise** dans le pays. Comptez de quelques jours à deux
  semaines de validation.
- **Coût vérifié le 2026-11-02 sur la page tarifs de Twilio** : un numéro mobile belge
  **1,40 $ par mois**.
- **Ensuite** Dans Vapi → **Phone Numbers** → *Import from Twilio*, avec votre
  `TELEPHONY_ACCOUNT_SID` et `TELEPHONY_AUTH_TOKEN`.

### Option 3 — Garder votre numéro actuel et renvoyer les appels

C'est le modèle retenu pour les artisans (ADR-022) : l'artisan garde le numéro imprimé sur
sa camionnette, et renvoie les appels non répondus vers Sophie.

- Il faut quand même un numéro chez Vapi (option 1 ou 2) comme destination du renvoi.
- Le renvoi se fait sur le téléphone, avec les codes de l'étape B7.

**Variables d'environnement** Pour l'option 2 uniquement, et seulement si vous importez
depuis Twilio : `TELEPHONY_PROVIDER=twilio`, `TELEPHONY_ACCOUNT_SID`,
`TELEPHONY_AUTH_TOKEN`. **Attention** : aucun adaptateur de téléphonie n'est écrit dans le
code — ces variables ne servent qu'à l'import côté Vapi, pas à l'application.

**Résultat attendu** Un numéro qui sonne et qui est rattaché à votre assistant.

**Comment vérifier** Appelez-le. Sophie doit décrocher et parler.

**Si ça échoue**
- Sonne dans le vide : le numéro n'est pas rattaché à l'assistant dans Vapi.
- Sophie décroche mais ne sait rien : les outils ne sont pas joignables. Revoyez A9 (la
  protection Vercel) puis B4.

## B6 — Déclarer le numéro dans Sophie et l'activer

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute** · dépend de **A2**, **B5** · **coût : 0 €**

**Quoi** Saisir le numéro dans l'application et activer Sophie.

**Pourquoi** C'était le problème le plus important de la version précédente. La table des
numéros était vide, donc l'application ne savait pas à quelle entreprise rattacher un appel
entrant : **tous les appels réels étaient marqués comme des essais**, exclus des prospects
et des statistiques. L'écran de déclaration est nouveau en 0.15.0.

**Les menus** Application → `/app/sophie` → **Ligne téléphonique**. Saisissez le numéro au
format international (`+1...` ou `+32...`), choisissez le fournisseur et le mode de
raccordement (renvoi, numéro dédié, portabilité).

Puis vérifiez que Sophie est active : l'en-tête doit afficher **« Sophie répond »** et non
« Sophie en pause ». Si elle est en pause, l'écran dit exactement pourquoi.

**Résultat attendu** Le numéro apparaît, avec la mention qu'aucun appel n'a encore été reçu.

**Comment vérifier** Après votre premier appel réel, l'écran affiche la date du premier
appel reçu. **Cette date est écrite par le webhook, pas par le formulaire** : c'est la seule
preuve que le routage fonctionne vraiment.

**Si ça échoue** « Numéro peu plausible » : l'application vérifie la longueur selon le pays.
Un numéro américain commence par `+1`, un belge par `+32` suivi de 8 ou 9 chiffres.

## B7 — Régler le renvoi d'appel sur votre téléphone

- [ ] Fait
`JE DOIS FAIRE` · priorité moyenne · dépend de **B6** · **coût : 0 €** (le renvoi peut être
facturé par votre opérateur mobile — vérifiez votre forfait)

**Quoi** Composer un code sur votre téléphone pour que les appels non répondus partent vers
Sophie.

**Pourquoi** C'est le mode de raccordement prévu pour les artisans : garder son numéro,
laisser Sophie prendre ce qu'on ne décroche pas.

**Les menus** L'écran `/app/sophie/ligne` affiche le code exact avec votre numéro dedans.
Les formes générales :

| But | Code à composer |
|---|---|
| Après 20 secondes sans réponse | `**61*<numéro Sophie>*11*20#` |
| Quand votre ligne est occupée | `**67*<numéro Sophie>#` |
| Tous les appels, tout de suite | `**21*<numéro Sophie>#` |
| Tout annuler | `##002#` |

Ce sont des codes standards du réseau mobile. Ils se composent sur le téléphone, comme un
numéro, et ne passent par aucun site.

**Résultat attendu** Le téléphone confirme l'enregistrement du renvoi.

**Comment vérifier** Demandez à quelqu'un de vous appeler et ne décrochez pas. Sophie doit
prendre l'appel après 20 secondes.

**Si ça échoue** Certains opérateurs refusent le renvoi vers l'international — ce qui bloque
le renvoi vers un numéro américain (option 1 de B5). Dans ce cas, testez en appelant
directement le numéro Sophie, et gardez le renvoi pour quand vous aurez un numéro belge.

## B8 — Remplir ce que Sophie a le droit de dire

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute** · dépend de **A7** · **coût : 0 €**

**Quoi** Compléter les services, les horaires, la zone, et les connaissances.

**Pourquoi** Sophie a l'interdiction d'inventer un tarif, une disponibilité, un service ou
une zone. Tout ce qui n'est pas renseigné, elle ne peut que le transmettre : « je note votre
demande, le professionnel vous rappelle ». Un écran vide ne donne pas une Sophie qui
improvise, il donne une Sophie qui ne peut rien dire.

**Les menus**
- `/app/reglages/services` — ce que vous proposez, la durée, le caractère urgent.
- `/app/reglages/horaires` — jours, heures, durée standard, marge entre interventions.
- `/app/reglages/absences` — congés, pour qu'elle ne propose rien pendant.
- `/app/sophie/connaissances` — questions fréquentes, consignes, informations.

**Résultat attendu** Au moins trois services, des horaires complets, et cinq connaissances.

**Comment vérifier** C'est l'étape B9 qui le vérifie vraiment : pendant l'appel, posez une
question dont la réponse est dans vos connaissances. Si Sophie répond correctement, la
chaîne fonctionne.

**Note honnête** Dans le code, l'outil qui lit vos connaissances existe et est testé. Mais
**que Sophie s'en serve réellement au téléphone n'a jamais été vérifié** : je ne peux pas
appeler un numéro depuis mon environnement. C'est la dernière ligne ouverte de l'audit, et
c'est votre premier appel qui la fermera.

## B9 — Le grand test : un appel de bout en bout

- [ ] Fait
`ACTION PARTAGÉE` · priorité **haute** · dépend de tout B · **coût : quelques dizaines de
centimes**

C'est le scénario du cahier des charges, section 63. Le détail complet est plus bas, dans
**Le test de validation**.

## B10 — SMS : compte, webhooks, test

- [ ] Fait
`JE DOIS FAIRE` · priorité moyenne · dépend de **A9**, **B5 option 2** · **coût vérifié le
2026-11-02 : 0,1113 $ par SMS envoyé vers un mobile belge**, 0,0075 $ par SMS reçu, plus
1,40 $/mois pour le numéro

**Quoi** Activer l'envoi réel des SMS de confirmation, de refus et d'annulation.

**Pourquoi** Aujourd'hui `MESSAGING_PROVIDER=mock` : les messages restent en file et
l'application affiche « SMS non envoyé — Réessayer ». Le client ne reçoit donc aucune
confirmation de son rendez-vous.

**Site** `https://console.twilio.com`

**Les menus**
1. **Messaging** → **Services** → créez un service, rattachez-y votre numéro.
2. Sur le numéro : *A message comes in* → `https://zelicall.com/api/messaging/inbound`,
   méthode POST.
3. *Status callback URL* → `https://zelicall.com/api/messaging/status`, méthode POST.

**Variables d'environnement** (Vercel)

```
MESSAGING_PROVIDER=twilio
MESSAGING_ACCOUNT_SID=<le SID du compte>
MESSAGING_API_KEY=<le jeton d'authentification, type Secret>
MESSAGING_SENDER_ID=<votre numéro au format +32... ou le nom SOPHIE>
```

**Sur le nom d'expéditeur** `SOPHIE` au lieu d'un numéro est accepté en Belgique et en
France, mais **interdit dans certains pays**, et le client ne peut alors pas répondre. Si
vous voulez qu'il puisse répondre, utilisez le numéro.

**Résultat attendu** Un vrai SMS arrive sur votre téléphone après avoir validé un
rendez-vous.

**Comment vérifier**

**SQL EDITOR SUPABASE**

```sql
select channel, status, provider_message_id, left(body, 60) as debut, created_at
from public.outbound_messages
order by created_at desc limit 5;
```

`status` doit passer à `SENT` puis `DELIVERED` grâce au webhook d'accusé de réception.

**Si ça échoue**
- Reste en `QUEUED` : l'application n'arrive pas à joindre l'opérateur.
  `/admin` → **Santé** donne le message exact.
- `status` ne passe jamais à `DELIVERED` : l'URL d'accusé de réception est mal déclarée, ou
  la protection Vercel la bloque (A9).
- « signature invalide » dans les journaux : le jeton d'authentification ne correspond pas.

## B11 — Notifications sur votre téléphone

- [ ] Fait
`JE DOIS FAIRE` · priorité basse · dépend de **A10** · **coût : 0 €**

**Quoi** Installer l'application sur l'écran d'accueil de votre téléphone.

**Pourquoi** Les alertes existent **dans** l'application : une pastille dans l'en-tête et
un écran `/app/notifications`. Installée sur l'écran d'accueil, elle s'ouvre comme une vraie
application.

**Les menus** Sur iPhone : Safari → ouvrez `https://zelicall.com` → bouton Partager → *Sur
l'écran d'accueil*. Sur Android : Chrome → menu → *Installer l'application*.

**Résultat attendu** Une icône Sophie IA sur votre écran d'accueil.

**Ce qui n'existe pas, et je préfère le dire** Les **notifications poussées** — celles qui
font vibrer le téléphone quand l'application est fermée — **ne sont pas développées**. Il
faut un service de notification et un consentement de l'utilisateur. Tant que ce n'est pas
fait, vous devez ouvrir l'application pour voir une urgence. C'est un vrai manque pour un
artisan sur un chantier, et c'est du développement, pas de la configuration.

---

# C — Avant de vendre à un vrai client

**But : vous pouvez facturer sans risque juridique ni technique.**
C'est la partie la plus longue, et la moins technique. Rien ici ne dépend de moi seul.

## C1 — Faire valider l'application Google

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute, et le délai ne se rattrape pas** · dépend de **B2** ·
**coût : 0 €**

**Quoi** Soumettre l'application Google à vérification.

**Pourquoi** Tant qu'elle est en mode Test, **Google révoque les autorisations au bout de
7 jours**. Chaque client perdrait son agenda une semaine après l'avoir connecté, et Sophie
cesserait de connaître ses disponibilités. C'est rédhibitoire pour vendre. La validation
prend de quelques jours à plusieurs semaines : commencez tôt (ADR-028).

**Site** `https://console.cloud.google.com` → **APIs & Services** → **OAuth consent
screen** → *Publish app* puis *Prepare for verification*.

**Valeurs à fournir** Un lien vers votre politique de confidentialité et vos conditions
(donc **C2 d'abord**), le domaine vérifié, et souvent une vidéo montrant à quoi sert
l'accès à l'agenda.

**Résultat attendu** Statut *In production*, et plus de révocation à 7 jours.

**Comment vérifier** Connectez un agenda avec une adresse qui **n'est pas** dans vos
testeurs. Si ça marche, c'est validé.

**Si ça échoue** Google demande souvent des précisions. Répondez, cela n'annule pas le
dossier. Demander le minimum de permissions accélère beaucoup.

## C2 — Les douze points juridiques

- [ ] Fait
`JE DOIS FAIRE` (avec un juriste) · priorité **haute, bloquante pour vendre** ·
**coût : à devis, souvent 500 à 2 000 € pour un premier jeu de documents** (estimation)

**Quoi** La liste complète est dans `docs/LEGAL_COMPLIANCE.md`, points L1 à L12. Les
quatre plus urgents :

| Point | Ce que c'est | Bloquant pour |
|---|---|---|
| L1 | Contrat de sous-traitance entre Sophie IA et l'entreprise cliente | tout client réel |
| L3 | Politique de confidentialité | toute inscription, et C1 |
| L4 | Conditions générales | toute inscription |
| L8/L9/L12 | Règles d'enregistrement des appels et texte d'annonce à l'appelant | tout enregistrement réel |

**Pourquoi** Vous traitez la voix, le nom, l'adresse et le problème de personnes qui n'ont
pas signé chez vous : les clients de vos clients. Enregistrer un appel sans information
correcte est le risque le plus concret du produit.

**Un point à ne pas oublier dans vos documents** Vapi est en région américaine (ADR-026).
Les transcriptions d'appels transitent donc hors d'Europe. Cela doit figurer dans votre
politique de confidentialité et dans votre registre des sous-traitants.

**Ce que le code fait déjà pour vous**
- Le texte d'annonce téléphonique est **marqué « NON VALIDÉ JURIDIQUEMENT »** partout où il
  apparaît, et une fonction en base (`recording_allowed()`) **empêche l'enregistrement** tant
  que la charte n'est pas acceptée.
- L'enregistrement est **désactivé par défaut**.
- Les durées de conservation sont réglables et les purges tracées (étape C3).

**Résultat attendu** Les douze cases de `LEGAL_COMPLIANCE.md` cochées, avec une date.

**Si ça échoue** Ne lancez pas « en attendant ». C'est le seul endroit de ce plan où je vous
le dis aussi fermement.

## C3 — Faire valider les trois durées de conservation

- [ ] Fait
`JE DOIS FAIRE` (avec le juriste de C2) · priorité **haute** · dépend de **A13**, **C2** ·
**coût : inclus dans C2**

**Quoi** Faire confirmer combien de temps garder les transcriptions, les résumés et les SMS.

**Pourquoi** Le mécanisme existe et fonctionne depuis la 0.15.0. **La valeur, non.** Un an
par défaut est un choix technique de ma part. Personne n'a vérifié qu'un an est correct pour
une transcription d'appel en Belgique ou en France, pour votre métier.

**Résultat attendu** Trois durées validées, saisies dans `/app/reglages/conservation`, et
la date de validation écrite dans `LEGAL_COMPLIANCE.md` au point L5.

**Comment vérifier** Après la première nuit, `/admin` → **Santé** → *Purges de conservation*
montre des lignes avec un nombre d'éléments supprimés.

## C4 — Facturation et abonnements

- [ ] Fait
`ACTION PARTAGÉE` · priorité **haute pour vendre** · dépend de **C2** ·
**coût : commission du prestataire de paiement, environ 1,5 % + 0,25 € par transaction en
Europe** (estimation)

**Ce qui est déjà développé** Les offres (`plans`), les abonnements (`subscriptions`), le
comptage de la consommation (`usage_records` : minutes d'appel, SMS, résumés, stockage),
l'écran `/app/reglages/consommation` qui affiche « 247 / 500 minutes », et l'écran
d'administration des offres.

**Ce qui n'existe pas** **Aucun paiement.** Rien ne prélève d'argent. Trois décisions vous
appartiennent avant que j'écrive la moindre ligne :

1. **Les prix.** Volontairement non fixés (section 38 du cahier des charges). Pour les
   fixer, vous avez besoin du coût réel par minute, que l'étape B9 vous donnera.
2. **Le prestataire de paiement.** Stripe est le choix habituel en Europe.
3. **Le modèle.** Abonnement fixe, ou abonnement plus minutes consommées ?

**Ce que je peux faire ensuite** `CLAUDE PEUT FAIRE` : brancher le prestataire, les pages de
paiement, les webhooks d'abonnement et le blocage à dépassement de quota. C'est du
développement classique, mais il ne sert à rien avant que les trois décisions soient prises.

## C5 — E-mails transactionnels

- [ ] Fait
`ACTION PARTAGÉE` · priorité moyenne · dépend de **A10** · **coût : 0 à 20 €/mois**
(estimation)

**Quoi** Pouvoir envoyer des e-mails depuis `zelicall.com`.

**Pourquoi** Aujourd'hui, inviter un collaborateur affiche un **lien à transmettre à la
main**. Ça passe pour vous, pas pour un client avec une équipe de cinq personnes.

**Ce qu'il faut** Un service d'envoi (Resend, Postmark, Brevo), et surtout des
enregistrements DNS corrects sur `zelicall.com` : sans eux, vos e-mails partent dans les
indésirables.

**Ce que je peux faire** `CLAUDE PEUT FAIRE` : l'adaptateur d'envoi et les modèles de
messages, une fois le service choisi.

## C6 — Monter un environnement de préproduction

- [ ] Fait
`ACTION PARTAGÉE` · priorité moyenne · dépend de **A7** · **coût : 0 €** (deuxième projet
Supabase gratuit)

**Quoi** Un deuxième site et une deuxième base, pour essayer les changements avant la
production.

**Pourquoi** Aujourd'hui, toute modification va directement chez vos clients. Le jour où
une migration se trompe, elle se trompe sur les vraies données.

**Les menus** Vercel crée déjà un aperçu par branche. Il manque la base : créez un second
projet Supabase `sophie-ia-staging`, appliquez-y les 30 migrations, et renseignez ses
variables dans l'environnement *Preview* de Vercel.

**Comment vérifier** Une branche de test affiche l'application avec des données qui ne sont
pas celles de la production.

## C7 — Sécurité avant les premiers clients

- [ ] Fait
`ACTION PARTAGÉE` · priorité **haute** · dépend de **A7** · **coût : 0 €**

**Ce que je dois vous demander de faire** `JE DOIS FAIRE` :

- Activer la **double authentification** sur GitHub, Vercel, Supabase, Google Cloud, Vapi et
  Twilio. Un de ces comptes compromis donne accès à tout.
- Garder les secrets dans un **gestionnaire de mots de passe**, pas dans un fichier.
- **Changer `SUPABASE_SERVICE_ROLE_KEY`** si elle a été copiée dans un endroit non sûr.

**Ce que je peux faire** `CLAUDE PEUT FAIRE` : lancer la suite d'isolation multi-tenant
contre une vraie base. Les 17 tests ignorés aujourd'hui vérifient qu'une entreprise ne voit
pas les données d'une autre. Il me faut pour cela les trois variables `SUPABASE_TEST_*`
renseignées **sur votre ordinateur** — idéalement contre la base de préproduction (C6), pas
la production.

**Comment vérifier** `npm test` affiche **356 tests passés et 0 ignoré**.

**Fait le 2026-11-04.** La préproduction existe, les 32 migrations y sont
appliquées, et la suite d'isolation est passée en entier contre elle. Reste la
double authentification sur les six comptes.

## C8 — Support et pages publiques

- [ ] Fait
`ACTION PARTAGÉE` · priorité moyenne · dépend de **C2** · **coût : 0 €**

**Quoi** Une page de présentation, une adresse de contact, et une page qui dit comment
demander la suppression de ses données.

**Pourquoi** Un appelant qui veut faire effacer l'enregistrement de son appel doit savoir à
qui écrire. C'est une obligation, et c'est aussi la première chose qu'un client vous
demandera.

**Ce que je peux faire** `CLAUDE PEUT FAIRE` : les pages, dès que vous avez les textes de
C2.

## C9 — Décider si vous passez Vercel en Pro

- [ ] Fait
`JE DOIS FAIRE` · priorité basse · dépend de **A11** · **coût ≈ 20 $/mois** (prix connu, à
reconfirmer)

**Quoi** Rien, pour l'instant. Juste savoir quand ce sera nécessaire.

**Pourquoi** Le plan gratuit limite les tâches planifiées à **une fois par jour**. Le
produit est conçu pour s'en contenter : la fraîcheur de l'agenda est garantie au moment où
une réponse en dépend, pas par la tâche de nuit (ADR-024). Vous passerez en Pro le jour où
vous voudrez que les SMS en attente repartent dans l'heure plutôt que la nuit suivante.

**Attention** Si vous passez en Pro et que vous rendez une tâche plus fréquente, changez
aussi la constante `PLAN` dans `tests/vercel-config.test.ts`, sinon un test échouera. C'est
voulu : il existe pour éviter qu'un déploiement soit refusé.

---

# Le test de validation, étape par étape

Voici le scénario complet, et **comment prouver** chaque étape plutôt que de la supposer.

Faites-le avec deux téléphones : un qui appelle (le « client »), un qui regarde
l'application (vous).

### 1. Le client appelle le numéro de Sophie

**Prouver** Sophie décroche et parle en français.

**Si ça échoue** Le numéro n'est pas rattaché à l'assistant dans Vapi (B5).

### 2. Sophie comprend la demande et utilise vos connaissances

**Ce que le client dit** « Bonjour, je m'appelle Marc Dupont. Est-ce que vous intervenez à
Tongres ? » puis une question dont la réponse est **dans vos connaissances** (B8).

**Prouver** Sophie répond correctement à la question, sans inventer. Puis, après l'appel :

**SQL EDITOR SUPABASE**

```sql
select c.started_at, c.status, c.is_test, t.name as outil, t.created_at
from public.calls c
left join public.call_tool_invocations t on t.call_id = c.id
order by c.started_at desc limit 20;
```

Vous devez voir `get_business_information` ou `check_service_area` dans les outils appelés.
**C'est la preuve que les connaissances sont utilisées pendant l'appel** — la dernière
chose que je n'ai pas pu vérifier moi-même.

**Si ça échoue** Si aucun outil n'apparaît : la protection Vercel bloque
`/api/voice/tools` (A9), ou les outils ne sont pas rattachés à l'assistant (B4).

**Si `is_test` vaut `true`** : votre numéro n'est pas déclaré dans `/app/sophie/ligne`, ou
il l'est dans un format différent de celui que Vapi envoie (B6).

### 3. Sophie consulte les vraies disponibilités

**Ce que le client dit** « J'aimerais un rendez-vous jeudi matin. »

**Prouver** Sophie propose un créneau **qui existe réellement**. Vérifiez qu'elle ne propose
pas un horaire où vous avez un événement dans Google Agenda (B2).

**Si ça échoue** Si elle dit qu'elle transmettra la demande au professionnel, c'est **le
comportement correct** quand l'agenda est injoignable — pas une panne. Vérifiez
`/admin` → **Santé** : une ligne `GOOGLE_CALENDAR` vous dira si la synchronisation a échoué.

### 4. Le créneau est bloqué et le rendez-vous est « à valider »

**Prouver** Dans l'application, `/app/agenda` montre un rendez-vous marqué **à valider**.
Et :

**SQL EDITOR SUPABASE**

```sql
select status, starts_at, ends_at, title, created_at
from public.appointments order by created_at desc limit 3;
```

Le statut doit être `PENDING_APPROVAL`.

### 5. L'audio, la transcription, le résumé et le prospect apparaissent

**Prouver** Ouvrez la fiche de l'appel dans `/app/appels`. Vous devez avoir :
le lecteur audio (**bouton Écouter qui fonctionne**), la transcription tour par tour, le
résumé, les informations extraites, et un prospect dans `/app/prospects`.

**SQL EDITOR SUPABASE**

```sql
select recording_status, transcription_status, summary_status, summary_source,
       duration_seconds
from public.calls order by started_at desc limit 3;
```

Les trois statuts doivent valoir `DONE`. `summary_source` ne doit **pas** valoir `MOCK`
(sinon : B3).

**Si l'audio manque** `/admin` → **Santé** affichera `RECORDING · rapatrierEnregistrement`.
Les adresses de téléchargement de Vapi **expirent en quelques minutes** : un audio raté est
un audio perdu, c'est l'échec le moins réversible du produit.

### 6. Vous validez le rendez-vous

**Prouver** Cliquez **Accepter**. Puis ouvrez **Google Agenda** : l'événement doit y être,
au bon horaire, avec le nom et le téléphone du client dans la description.

**Si ça échoue** L'application affiche « Le rendez-vous est enregistré, mais il n'a pas pu
être écrit dans votre agenda Google » — c'est volontaire : elle ne prétend jamais que tout
est confirmé quand ce n'est pas vrai. Utilisez *Réessayer*.

### 7. Le client reçoit le SMS

**Prouver** Un vrai SMS arrive sur le téléphone du client.

**Si ça échoue** Vérifiez `outbound_messages` (requête de B10). Un SMS échoué
**n'annule jamais** le rendez-vous : il reste confirmé, et l'écran propose de réessayer.

### 8. Tout est dans l'historique

**Prouver** La fiche du contact montre la suite : appel reçu → rendez-vous proposé → accepté
→ SMS envoyé, avec les heures.

---

# Tableau récapitulatif

| # | Plateforme | Action | Qui | Priorité | Coût | Statut | Preuve de réussite |
|---|---|---|---|---|---|---|---|
| A1 | GitHub | Publier le code | Moi | Haute | 0 € | ☐ | Dépôt privé, pas de `.env` |
| A2 | Supabase | Migrations 0025→0030 | Partagé | **Bloquante** | 0 € | ☐ | La requête renvoie 9 |
| A3 | Supabase | Vérifier RLS | Partagé | Haute | 0 € | ☐ | Liste des tables sans RLS vide |
| A4 | Supabase | Bucket audio privé | Moi | Haute | 0 € | ☐ | `public` = `false` |
| A5 | Ordinateur | Générer 3 secrets | Moi | Haute | 0 € | ☐ | 3 valeurs de 44 caractères |
| A6 | Vercel | 8 variables | Moi | **Bloquante** | 0 € | ☐ | `npm run check:env` |
| A7 | Vercel | Déployer | Moi | Haute | 0 € | ☐ | `/api/health` répond |
| A8 | Supabase | Compte super admin | Partagé | Moyenne | 0 € | ☑ fait 2026-11-03 | `/admin` s'ouvre |
| A9 | Vercel | Exempter les webhooks | Moi | **Piège** | 0 € | ☐ | `curl` renvoie du JSON |
| A10 | Vercel + DNS | Domaine zelicall.com | Moi | Moyenne | 0 € | ☐ | HTTPS valide |
| A11 | Vercel | Tâches planifiées | Moi | Moyenne | 0 € | ☐ | Purge visible dans `/admin` |
| A12 | Supabase | Sauvegardes | Moi | Haute | 0 € | ☐ | Nombre de jours noté |
| A13 | Application | Durées de conservation | Moi | Moyenne | 0 € | ☐ | Requête SQL |
| B1 | Google Cloud | OAuth + Calendar API | Moi | Haute | 0 € | ☐ | Pas de `redirect_uri_mismatch` |
| B2 | Application | Connecter l'agenda | Moi | Haute | 0 € | ☐ | Créneaux 9h–11h disparus |
| B3 | Mistral | Clé IA | Moi | Haute | ≈ 1–5 €/mois (est.) | ☐ | `summary_source` ≠ `MOCK` |
| B4 | Vapi | Compte, assistant, outils | Partagé | Haute | 10 $ offerts, puis 0,05 $/min (vérifié) | ☐ | Outils visibles dans Vapi |
| B5 | Vapi / Twilio | Numéro | Moi | **Le vrai blocage** | ≈ 2 $/mois (est.) ou 1,40 $/mois (vérifié) | ☐ | Sophie décroche |
| B6 | Application | Déclarer la ligne | Moi | Haute | 0 € | ☐ | Date de 1er appel reçu |
| B7 | Téléphone | Renvoi d'appel | Moi | Moyenne | selon forfait | ☐ | Appel non décroché → Sophie |
| B8 | Application | Services, horaires, connaissances | Moi | Haute | 0 € | ☐ | Sophie répond juste |
| B9 | Tout | Appel de bout en bout | Partagé | Haute | centimes | ☐ | Les 8 étapes du test |
| B10 | Twilio | SMS réels | Moi | Moyenne | 0,1113 $/SMS (vérifié) | ☐ | `status` = `DELIVERED` |
| B11 | Téléphone | Installer la PWA | Moi | Basse | 0 € | ☐ | Icône sur l'écran d'accueil |
| C1 | Google Cloud | Validation de l'app | Moi | Haute, long | 0 € | ☐ | Statut *In production* |
| C2 | Juriste | Les 12 points | Moi | **Bloquante pour vendre** | 500–2 000 € (est.) | ☐ | 12 cases datées |
| C3 | Juriste | Valider les durées | Moi | Haute | inclus C2 | ☐ | L5 daté |
| C4 | Stripe + moi | Paiement | Partagé | Haute pour vendre | ≈ 1,5 % + 0,25 € (est.) | ☐ | Un abonnement payé |
| C5 | Service e-mail | E-mails transactionnels | Partagé | Moyenne | 0–20 €/mois (est.) | ☐ | Invitation reçue |
| C6 | Supabase + Vercel | Préproduction | Partagé | Moyenne | 0 € | ☑ base créée 2026-11-04 | 32 migrations appliquées |
| C7 | Tous | 2FA + tests d'isolation | Partagé | Haute | 0 € | ☑ tests faits 2026-11-04 ; 2FA à faire | 356 tests, 0 ignoré |
| C8 | Application | Support et pages | Partagé | Moyenne | 0 € | ☐ | Page de contact en ligne |
| C9 | Vercel | Plan Pro si besoin | Moi | Basse | ≈ 20 $/mois | ☐ | Décision notée |

**Dépendances à respecter.** A2 avant tout le reste de A. A6 et A9 avant B4. A10 avant B1.
B4 et B5 avant B6. B6 avant B9. C2 avant C1 et C4.

---

# Rapport d'état au 2026-11-02

## Ce qui fonctionne réellement, vérifié contre les vrais services

- Inscription, connexion, isolation entre entreprises (vérifié contre la vraie base le
  2026-09-08).
- Google Calendar : autorisation, chiffrement des jetons, synchronisation, et surtout
  **vérification par l'usage** — un événement réel a bien retiré les créneaux correspondants
  (2026-10-15).
- Sophie répond au téléphone en français, comprend, et appelle ses outils (22 et 23 octobre,
  depuis le navigateur).
- L'audio d'un appel est rapatrié chez vous, stocké en privé et **écouté** (2026-10-23).
- La transcription s'affiche tour par tour, horodatée.
- Anti-double réservation : garanti par une contrainte de la base, jamais par du code ni par
  l'IA.

## Développé, jamais exercé en conditions réelles

- Validation d'un rendez-vous écrite dans Google Calendar.
- Refus, annulation, proposition d'un autre horaire par lien.
- Corbeille des appels, pagination, recherche.
- Les six purges de conservation.
- L'écran de la ligne téléphonique.
- L'écran des tâches.
- L'espace d'administration en entier.
- **L'usage des connaissances de Sophie pendant un appel.** L'outil est écrit et testé ; que
  Sophie s'en serve au téléphone n'est pas prouvé. C'est l'étape 2 du test de validation qui
  le prouvera.

## Il ne manque qu'une configuration

| Fonction | Ce qui manque |
|---|---|
| Résumé et extraction réels | `AI_API_KEY` (B3) |
| SMS | compte opérateur (B10) |
| Appel sur un vrai numéro | un numéro (B5) |
| Agenda d'un client qui n'est pas vous | validation Google (C1) |
| Espace d'administration | un compte marqué administrateur (A8) |

## Il manque encore du développement

| Fonction | Pourquoi ce n'est pas fait |
|---|---|
| Paiement et abonnements réels | vos prix et votre prestataire ne sont pas décidés (C4) |
| Notifications poussées sur le téléphone | demande un service de notification et un consentement |
| E-mails transactionnels | demande un service d'envoi (C5) |
| WhatsApp, e-mail, formulaire web | les tables existent, aucun adaptateur |
| Voix et style de Sophie réglables dans l'application | se règlent chez Vapi aujourd'hui |
| Qualité du français de la transcription | « Tongeren » devient « Tangerine », les numéros dictés sont tronqués ; trois transcripteurs restent à comparer |

## Ce qui bloque la vente

1. **Les documents juridiques** (C2). C'est le seul blocage absolu.
2. **La validation Google** (C1), sinon chaque client perd son agenda en 7 jours.
3. **Un numéro belge ou français** (B5, option 2).
4. **Le paiement** (C4), qui attend vos prix.
5. **Les durées de conservation validées** (C3).

## Ce qu'il faut garder en tête

Le code compile, les 338 tests passent, le build est vert. **Cela ne veut pas dire que le
produit fonctionne.** La version 0.5.1 passait tous les contrôles et Vercel a refusé son
déploiement. Un test vérifie une logique ; seul un appel réel vérifie un appel.

Trois fonctions centrales n'ont jamais touché un service réel : le résumé, le SMS, et
l'appel sur un vrai numéro. Les trois dépendent d'un compte ou d'une clé, pas d'une ligne de
code.

---

# D — Référencement, Search Console et mesure

Ajouté le 2026-11-04, avec la version 0.17.0. Rien ici ne coûte d'argent.

Jusqu'à cette version, le site n'avait **aucune page publique** : `/` renvoyait vers la
connexion. Il y a maintenant une page d'accueil, un `robots.txt`, un plan du site et une
mesure de fréquentation. Ce qui suit, c'est ce qui ne peut pas se faire depuis le code.

## D1 — Vérifier que le site public est en ligne et indexable

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute** · dépend de **A10** · **coût : 0 €**

**Quoi** Déployer la 0.17.0, puis regarder trois adresses.

**Pourquoi** `robots.txt` et le plan du site ne s'activent que si `NEXT_PUBLIC_APP_ENV`
vaut exactement `production`. Avec une autre valeur, tout le site reste en « ne pas
indexer » — c'est volontaire, et c'est le genre de réglage qu'on découvre six mois plus
tard en se demandant pourquoi Google ignore le site.

**Les adresses à ouvrir**

```
https://zelicall.com/
https://zelicall.com/robots.txt
https://zelicall.com/sitemap.xml
```

**Réussi** La première affiche la page d'accueil. La deuxième contient `Allow: /` et une
ligne `Sitemap:`. La troisième liste deux adresses.

**Si `robots.txt` dit `Disallow: /`** `NEXT_PUBLIC_APP_ENV` ne vaut pas `production` sur
Vercel. Corrigez la variable, puis **relancez un déploiement** : elle est lue à la
compilation.

## D2 — Appliquer les migrations 0033, 0034 et 0035

- [ ] Fait
`ACTION PARTAGÉE` · priorité **haute, bloquante** · **coût : 0 €**

**Quoi** Coller dans l'éditeur SQL de la production, **dans cet ordre** :

1. `supabase/migrations/20261104120000_0033_analytics_and_stats.sql`
2. `supabase/migrations/20261105100000_0034_platform_configuration.sql`
3. `supabase/migrations/20261105140000_0035_seo_pages.sql`

Puis les mêmes sur la préproduction.

**Pourquoi** Sans 0033, la vue d'ensemble, les statistiques, la consommation et l'écran
SEO affichent une erreur : ils appellent des fonctions qui n'existent pas. Sans 0034,
aucune clé ne peut être saisie depuis la console. Sans 0035, le référencement page par
page et l'envoi de l'image de partage échouent.

**Vérifier**

```sql
select count(*) as fonctions
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('platform_stats','platform_series','usage_totals','site_traffic',
                    'site_sources','site_pages','site_series','integration_health',
                    'record_integration_check');
```

**Réussi** Le résultat est **9**.

Puis, pour 0034 et 0035 :

```sql
select
  (select count(*) from information_schema.tables
    where table_schema = 'public'
      and table_name in ('platform_settings','provider_credentials',
                         'search_console_connection','seo_pages')) as tables,
  (select count(*) from storage.buckets where id = 'public-assets') as bucket,
  (select count(*) from public.seo_pages) as pages_semees;
```

**Réussi** `tables` = **4**, `bucket` = **1**, `pages_semees` = **2**.

## D3 — Vérifier la propriété du site dans Search Console

- [ ] Fait
`ACTION PARTAGÉE` · priorité **haute** · dépend de **D1** · **coût : 0 €**

**Quoi** Prouver à Google que le domaine est à vous.

**Pourquoi** Sans cela, aucune donnée de recherche : ni les mots tapés par les visiteurs,
ni les positions, ni les erreurs d'indexation. Ce sont des informations que **seul**
Google détient ; aucun outil ne les remplace, et l'écran SEO affiche « Connexion
nécessaire » tant qu'elles manquent.

**Site** `https://search.google.com/search-console`

**Les menus** *Ajouter une propriété*. Deux choix :

- **Préfixe d'URL** — plus simple. Choisissez la méthode **Balise HTML**. Google affiche
  une balise ; copiez **uniquement** le contenu de l'attribut `content`, pas la balise
  entière.
- **Domaine** — couvre aussi les sous-domaines, mais demande un enregistrement DNS TXT
  chez votre registrar.

**Variable d'environnement** `GOOGLE_SITE_VERIFICATION`, type **Config**, sur Vercel.
Puis **relancez un déploiement** — elle est lue à la compilation.

**Réussi** Google affiche « Propriété validée ». Dans la console, `/admin/seo` fait
passer la ligne « Vérification Search Console » en *en place*.

**Cette étape reste manuelle, et le restera.** La connexion de D3b lit les données de
Search Console ; elle ne peut pas vérifier une propriété à votre place. Cela demanderait
un droit d'écriture sur votre compte Google que l'application ne demande pas — et un
accès au DNS que seul votre registrar vous donne.

**Si Google ne trouve pas la balise** Vous avez probablement collé la balise entière au
lieu du seul contenu de `content`. Regardez le code source de `https://zelicall.com` : la
ligne doit ressembler à `<meta name="google-site-verification" content="...">`.

## D3b — Ajouter la portée Search Console et connecter

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute** · dépend de **B1**, **D3** · **coût : 0 €**

**Quoi** Autoriser l'application à **lire** vos données Search Console, puis cliquer sur
le bouton de connexion.

**Pourquoi** La vérification de propriété (D3) prouve à Google que le site est à vous.
Elle ne donne rien à l'application. Sans cette connexion, `/admin/seo` ne peut afficher
aucune position, aucune impression, aucun mot tapé par un visiteur — et il l'écrit au lieu
d'inventer un classement.

**Site** `https://console.cloud.google.com`

**Les menus**
1. **APIs & Services** → **Library** → cherchez *Google Search Console API* → *Enable*.
2. **APIs & Services** → **OAuth consent screen** → **Data Access** (ou *Scopes* selon la
   version) → *Add or remove scopes* → collez cette ligne exactement :

```
https://www.googleapis.com/auth/webmasters.readonly
```

3. **APIs & Services** → **Credentials** → votre identifiant OAuth → **Authorized
   redirect URIs** → *Add URI* → collez exactement :

```
https://zelicall.com/api/integrations/search-console/callback
```

4. *Save*.

**Puis, dans Sophie** `/admin/seo` → **Connecter Search Console** → choisissez votre
compte Google → *Autoriser*. De retour sur l'écran, choisissez la propriété à suivre dans
la liste déroulante (celle validée en D3).

**Réussi** La carte Search Console affiche *connecté* et le nom de la propriété.

**Pourquoi « readonly »** C'est la seule portée demandée : lecture des propriétés Search
Console, rien d'autre. Elle ne permet ni de modifier votre compte Google, ni de lire vos
mails, ni de toucher à votre agenda — cette dernière passe par la portée Calendar, déjà
en place et distincte.

**Si l'écran affiche « Google a refusé l'échange du jeton »** L'adresse de retour du
point 3 n'est pas déclarée, ou pas à l'identique. Un `/` en trop à la fin suffit à faire
échouer l'échange.

**Si l'écran affiche « aucune propriété vérifiée »** D3 n'est pas terminée, ou le compte
Google choisi à l'autorisation n'est pas celui qui détient la propriété.

**Les chiffres restent à zéro quelques jours** Google ne publie rien avant deux à trois
jours, et n'a rien à publier avant d'avoir indexé le site. L'écran le dit sous les
chiffres.

## D4 — Déposer le plan du site

- [ ] Fait
`JE DOIS FAIRE` · priorité moyenne · dépend de **D3** · **coût : 0 €**

**Quoi** Dire à Google où est le plan du site.

**Les menus** Search Console → **Sitemaps** → saisir `sitemap.xml` → *Envoyer*.

**Réussi** Statut « Réussite », deux URL découvertes.

**Attention** Google met de quelques jours à quelques semaines à indexer un site neuf.
Rien de ce que vous ferez n'accélère cela de façon fiable.

## D5 — Fabriquer l'image de partage

- [ ] Fait
`ACTION PARTAGÉE` · priorité basse · **coût : 0 €**

**Quoi** Une image qui s'affiche quand quelqu'un partage un lien vers zelicall.com sur
WhatsApp, LinkedIn ou un message.

**Pourquoi** Aujourd'hui il n'y en a pas : le lien s'affiche en texte gris. C'est la
différence entre un lien qu'on clique et un lien qu'on ignore.

**Ce qu'il faut** Une image 1200 × 630 pixels, en PNG, JPEG ou WebP, sous 2 Mo.

**Les menus** `/admin/seo` → section **Image de partage** → *Nouvelle image* → choisissez
le fichier → *Appliquer à : tout le site* → **Envoyer l'image**.

Elle est stockée chez nous et l'aperçu s'affiche immédiatement sur l'écran. Vous pouvez
aussi l'appliquer à une seule page.

**Dites-moi ce que vous voulez dessus et je la fabrique** ; ou fournissez-la, et vous
l'envoyez vous-même en trois clics.

**Pour vérifier le rendu réel** Collez `https://zelicall.com` dans une conversation
WhatsApp sans envoyer le message : l'aperçu se construit. Les réseaux sociaux gardent
longtemps en cache l'ancienne image d'une même adresse — c'est pourquoi chaque envoi
porte un nom de fichier neuf.

## D6 — Regarder la fréquentation après une semaine

- [ ] Fait
`JE DOIS FAIRE` · priorité basse · dépend de **D1**, **D2** · **coût : 0 €**

**Les menus** `/admin/seo`.

**Ce que vous y verrez** Visites humaines probables, trafic incertain, robots identifiés,
sources, pages les plus vues.

**Comment lire ces chiffres** Ce sont des **planchers**, jamais des totaux. Les bloqueurs
de publicité refusent la requête de mesure, et l'empreinte de session change chaque jour
— quelqu'un qui revient trois jours compte trois fois. C'est le prix de l'absence de
cookie, donc de l'absence de bannière de consentement. Les limites sont écrites en bas de
l'écran.

## D7 — Faire valider la mesure de fréquentation

- [ ] Fait
`JE DOIS FAIRE` (avec le juriste de C2) · priorité moyenne · **coût : inclus dans C2**

**Quoi** Faire confirmer que la mesure est exemptée de consentement.

**Pourquoi** Sans cookie, sans stockage navigateur, sans identifiant persistant et sans
transfert à un tiers, elle relève de la statistique strictement nécessaire, pour laquelle
les autorités françaises et belges admettent une exemption. **Ce raisonnement est le
mien, pas celui d'un juriste.**

Le jour où vous ajouteriez un outil tiers, un cookie ou un identifiant persistant,
l'exemption tombe immédiatement et il faut une bannière.

---

# E — Après la 0.18.0 : configurer depuis la console

Ajouté le 2026-11-05. La console sait maintenant enregistrer vos clés : vous n'avez plus
besoin de Vercel pour la plupart d'entre elles.

## E1 — Corriger `NEXT_PUBLIC_APP_ENV`

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute** · **coût : 0 €**

**Quoi** Mettre cette variable à `production` sur Vercel.

**Pourquoi** Votre écran SEO le dit déjà : « NEXT_PUBLIC_APP_ENV ne vaut pas production :
tout est en noindex ». Tant que c'est le cas, `robots.txt` interdit tout, le plan du site
est vide, et **Google ne peut pas indexer votre site**. C'est la seule chose qui bloque
le référencement aujourd'hui, et elle ne demande pas une ligne de code.

**Les menus** Vercel → votre projet → **Settings** → **Environment Variables** →
`NEXT_PUBLIC_APP_ENV` → valeur `production`, environnement **Production**.

**Puis relancez un déploiement.** Cette variable est lue à la compilation : la changer
sans redéployer ne change rien.

**Réussi** `https://zelicall.com/robots.txt` affiche `Allow: /` et une ligne `Sitemap:`.
Dans la console, `/admin/seo` fait passer les deux lignes « à vérifier » en *en place*.

## E2 — Appliquer la migration 0034

- [ ] Fait
`ACTION PARTAGÉE` · priorité **haute, bloquante** · **coût : 0 €**

**Quoi** Coller `supabase/migrations/20261105100000_0034_platform_configuration.sql` dans
l'éditeur SQL de la production, puis de la préproduction.

**Pourquoi** Sans elle, les écrans Intégrations et Paramètres ne peuvent rien enregistrer.

**Vérifier**

```sql
select count(*) as tables
from information_schema.tables
where table_schema = 'public'
  and table_name in ('platform_settings','provider_credentials','search_console_connection');
```

**Réussi** Le résultat est **3**.

## E3 — Vérifier que `SECRETS_ENCRYPTION_KEY` existe sur Vercel

- [ ] Fait
`JE DOIS FAIRE` · priorité **haute** · **coût : 0 €**

**Pourquoi** C'est elle qui chiffre les clés que vous allez saisir. Sans elle, la console
refusera d'enregistrer et vous dira pourquoi.

**Attention** Si vous la changez un jour, **toutes les clés enregistrées deviennent
illisibles**, et les agendas Google de vos clients aussi. Ce n'est pas une variable qu'on
fait tourner sans préparation.

**Réussi** Enregistrer une clé dans `/admin/integrations` fonctionne.

## E4 — Saisir vos clés depuis la console

- [ ] Fait
`JE DOIS FAIRE` · priorité moyenne · dépend de **E2**, **E3** · **coût : 0 €**

**Les menus** `/admin/integrations`. Pour chaque fournisseur : le formulaire, puis
**Enregistrer**, puis **Tester la connexion**.

**Ce que le test prouve** Que vos identifiants sont acceptés et que le service répond.
**Pas** qu'un vrai SMS arrivera ni qu'un vrai appel aboutira — seul un vrai envoi et un
vrai appel le diront.

**Ce qui est gratuit** Les tests du fournisseur vocal, de l'opérateur SMS, de la base et
de Google. **Ce qui coûte** Le test de l'IA : quelques centièmes de centime.

**Réussi** La pastille passe à *Opérationnel*, et l'écran de santé affiche une date de
dernier échange réussi.

## E5 — Régler le site public

- [ ] Fait
`JE DOIS FAIRE` · priorité moyenne · dépend de **E2** · **coût : 0 €**

**Les menus** `/admin/parametres`. Titre, description, adresse canonique, image de
partage, adresses de contact. L'aperçu montre ce que Google affichera.

**Ne changez pas l'adresse canonique** sans avoir d'abord configuré le domaine sur Vercel,
le DNS chez votre registrar, et l'adresse de retour OAuth chez Google. Le formulaire écrit
une adresse ; il ne déplace pas le site. S'il détecte que les deux ne correspondent pas,
il vous le dit.

**Réussi** Ouvrez `https://zelicall.com` en navigation privée, affichez le code source
(Ctrl+U) : le `<title>` et la `<meta name="description">` portent vos valeurs.

## E6 — Connecter Search Console

- [ ] Fait
`JE DOIS FAIRE` · priorité moyenne · **coût : 0 €**

**Pour l'instant, à la main.** Voir la section **D3** et **D4** de ce document : balise de
vérification via `GOOGLE_SITE_VERIFICATION`, puis dépôt du plan du site.

Le bouton « Connecter Google Search Console » n'existe pas encore dans la console. La
table et l'état sont prêts ; la connexion OAuth reste à écrire. Je préfère vous le dire
plutôt que de livrer un bouton qui ne ferait rien.
