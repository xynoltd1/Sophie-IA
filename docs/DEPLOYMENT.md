# Déploiement

## Chaîne cible

```
Local  →  GitHub  →  Vercel Preview (staging)  →  Vercel Production
```

Trois environnements : `development`, `staging`, `production`. Chacun a **son propre
projet Supabase**. On ne teste jamais une migration sur la base qui sert de vrais clients.

## 1. Supabase

1. Créer un projet sur https://supabase.com (région européenne recommandée pour le RGPD).
2. *Project Settings → API* : relever l'URL du projet, la clé `anon`, la clé `service_role`.
3. Appliquer les migrations :

```bash
npx supabase login
npx supabase link --project-ref VOTRE_REF
npx supabase db push
```

Sans la CLI : ouvrir chaque fichier de `supabase/migrations/` dans l'éditeur SQL, dans
l'ordre des noms.

4. *Authentication → URL Configuration* :
   - Site URL : l'URL de l'environnement ;
   - Redirect URLs : `https://zelicall.com/**` et `http://localhost:3000/**`.
5. En staging et en production, activer la confirmation d'e-mail.

## 2. GitHub

```bash
git init
git add .
git commit -m "feat: phase 0 — fondations, multi-tenant, RLS, design system"
git branch -M main
git remote add origin git@github.com:VOTRE_COMPTE/sophie-ia.git
git push -u origin main
```

Vérifiez avant de pousser que `git status` ne montre aucun `.env`.

## 3. Vercel

1. *New Project* → importer le dépôt GitHub. Next.js est détecté automatiquement.
2. Variables d'environnement — à saisir pour chaque environnement :

| Variable | Preview | Production | Exposée au navigateur |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | staging | production | oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging | production | oui |
| `SUPABASE_SERVICE_ROLE_KEY` | staging | production | **non** |
| `NEXT_PUBLIC_APP_URL` | URL preview | domaine final | oui |
| `NEXT_PUBLIC_APP_ENV` | `staging` | `production` | oui |

`SUPABASE_SERVICE_ROLE_KEY` ne doit jamais être préfixée `NEXT_PUBLIC_`. Cette clé
contourne RLS : exposée au navigateur, elle donne accès à toutes les données de tous les
clients.

3. Déployer. Vérifier `https://VOTRE-URL/api/health`.

## Contraintes serverless à ne pas oublier

- Pas de processus permanent : aucun worker de fond, aucune connexion WebSocket longue
  durée. Les traitements asynchrones passent par une table de jobs et Vercel Cron.
- Durée d'exécution limitée par fonction : découper les traitements longs.
- Système de fichiers en lecture seule hors `/tmp`, et non partagé entre invocations.

## Avant chaque mise en production

```bash
npm run check      # typecheck + lint + tests + build
```

Puis : migrations appliquées d'abord en staging, RLS vérifié sur les nouvelles tables,
`CHANGELOG.md` et `CLAUDE_HANDOFF.md` à jour.

---

## Réglages Vercel à vérifier

### Région d'exécution — important

`vercel.json` fixe `"regions": ["fra1"]` (Francfort). Ce n'est pas une préférence de
latence : le registre des sous-traitants (`LEGAL_COMPLIANCE.md`, point L2) engage
Sophie IA sur un traitement en Union européenne. Une exécution par défaut à `iad1`
(Washington) placerait les données de vos clients hors UE.

Le fichier ne suffit pas toujours : vérifiez aussi *Project Settings → Functions →
Function Region*, et que le projet Supabase associé est bien lui aussi en région
européenne.

**Point ouvert, à ne pas confondre** : le middleware Next.js s'exécute sur le réseau de
périphérie, réparti mondialement, indépendamment de cette région. Il ne manipule que les
cookies de session et le jeton, sans donnée métier — mais ce point doit être vérifié et
consigné au registre avant la production (L2).

### Autres réglages

| Réglage | Recommandé | Pourquoi |
|---|---|---|
| Function Region | `fra1` | conformité, voir ci-dessus |
| Skew Protection | activé | évite qu'un navigateur sur l'ancienne version appelle la nouvelle API pendant un déploiement |
| Deployment Protection | activé | protège les previews — **mais bloquera les webhooks en Phase 4** : il faudra exempter les routes `/api/webhooks/*` |
| Node.js Version | piloté par `package.json` (`22.x`) | l'avertissement affiché signale simplement que le réglage projet (24.x) est surchargé par le dépôt. C'est le comportement voulu |

## Dépannage du déploiement

### Le build échoue sur « Error occurred prerendering page »

Message : `Configuration incomplete : NEXT_PUBLIC_SUPABASE_URL, …`

Les variables d'environnement ne sont pas définies sur Vercel. Allez dans *Project
Settings → Environment Variables* et ajoutez-les **pour chaque environnement** — Production,
Preview et Development ont chacun leur propre jeu de valeurs.

Point qui surprend souvent : les variables `NEXT_PUBLIC_` sont lues **au moment du build**,
pas à l'exécution. Les ajouter ne suffit pas — il faut relancer un déploiement pour qu'elles
soient prises en compte. Sur Vercel : *Deployments → … → Redeploy*.

### Avertissement sur la version de Node

`Detected "engines": { "node": ">=20.9.0" } … will automatically upgrade`

Une plage ouverte laisse Vercel passer à la version majeure suivante dès sa sortie, ce qui
peut casser un build sans que rien n'ait changé côté code. `package.json` fixe désormais
`"node": "22.x"` : les correctifs sont appliqués, les changements de version majeure sont
un choix explicite.

### Avertissements npm sur les scripts d'installation

`2 packages have install scripts not yet covered by allowScripts` (esbuild,
unrs-resolver). Ce sont des dépendances de développement légitimes, tirées par Vitest et
ESLint. L'avertissement est informatif et n'empêche pas le build.

### Taux d'erreur à 100 % après un déploiement réussi

Le build passe mais chaque requête échoue. Cause quasi certaine : les variables
d'environnement Supabase manquent. Le middleware s'exécute sur **toutes** les requêtes et
appelle Supabase ; sans configuration, il lève une erreur avant même d'atteindre une page.

C'est cohérent avec un build vert depuis la version 0.1.4 : le build ne dépend plus des
variables, l'exécution si.

### Vérifier qu'un déploiement fonctionne

1. `https://VOTRE-URL/api/health` doit répondre `{"status":"ok", …}`.
2. `https://VOTRE-URL/login` doit afficher le formulaire.
3. Créer un compte, puis une entreprise. Si la création échoue, les migrations ne sont pas
   appliquées sur le projet Supabase pointé par vos variables.

---

# Domaine

Le domaine de production est **zelicall.com**, acheté le 2026-10-13.

L'adresse `sophie-ia-xynoltd1.vercel.app` continue de fonctionner. Vercel garde toujours
son adresse d'origine en plus du domaine personnalisé. Elle sert de secours si le domaine
pose problème.

**Rien à changer dans le code.** Toutes les adresses sont lues depuis des variables
d'environnement — c'était déjà le cas avant l'achat du domaine.

## Relier le domaine à Vercel

1. Dans Vercel, ouvrez le projet, puis *Settings → Domains*.
2. Tapez `zelicall.com` et cliquez sur **Add**.
3. Vercel affiche les enregistrements DNS à créer chez le vendeur du domaine.
4. Chez le vendeur, créez ces enregistrements exactement comme Vercel les affiche.
5. Attendez que Vercel passe le domaine en **Valid**. Cela prend de quelques minutes à
   quelques heures.

## Après que le domaine fonctionne

Trois endroits attendent la nouvelle adresse. Les oublier casse la connexion.

**Vercel** — ajoutez ou modifiez `NEXT_PUBLIC_APP_URL` avec la valeur
`https://zelicall.com`, type **Config**. Puis redéployez, car les variables
`NEXT_PUBLIC_` sont lues au moment du build.

**Supabase** — *Authentication → URL Configuration*. Mettez `https://zelicall.com` comme
Site URL, et ajoutez `https://zelicall.com/**` aux Redirect URLs. Sans cela, la connexion
par e-mail renverra l'utilisateur vers l'ancienne adresse.

**Google Cloud** — les URI de redirection autorisés sont listés plus bas, dans la section
Google Calendar.

---

# Comptes externes à créer

Chaque section donne les étapes dans l'ordre d'exécution. Aucune clé ne doit être envoyée
par message : elles se saisissent directement dans Vercel et dans `.env.local`.

## 1. Clés de chiffrement et de planification

Ces deux valeurs ne viennent d'aucun fournisseur : vous les générez vous-même.

1. Ouvrez un terminal et lancez `openssl rand -base64 32`. Copiez le résultat.
2. Dans Vercel, ouvrez le projet, puis *Settings → Environment Variables*.
3. Ajoutez `SECRETS_ENCRYPTION_KEY`, type **Secret**, environnements Production et
   Preview, avec la valeur générée.
4. Relancez `openssl rand -base64 32` pour obtenir une seconde valeur, différente.
5. Ajoutez `CRON_SECRET`, type **Secret**, mêmes environnements, avec cette seconde valeur.
6. Ajoutez les deux mêmes lignes dans votre fichier `.env.local`, sur votre machine.

`SECRETS_ENCRYPTION_KEY` chiffre les jetons d'agenda. **La changer plus tard rendra
illisibles tous les jetons déjà stockés** et obligera chaque client à reconnecter son
agenda. Conservez-la.

## 2. Google Calendar

Compte à créer : **Google Cloud**, sur `https://console.cloud.google.com`. Gratuit pour
cet usage.

1. Créez un projet, nommez-le `Sophie IA`.
2. Dans *APIs & Services → Library*, cherchez « Google Calendar API » et cliquez
   **Enable**.
3. Dans *APIs & Services → OAuth consent screen*, choisissez **External**, puis
   renseignez le nom de l'application, votre adresse d'assistance et votre adresse de
   contact.
4. À l'étape *Scopes*, ajoutez uniquement
   `https://www.googleapis.com/auth/calendar.events`. N'ajoutez rien d'autre : Google
   demande une vérification plus lourde pour les périmètres étendus.
5. À l'étape *Test users*, ajoutez votre propre adresse Gmail. Tant que l'application est
   en mode test, seules les adresses listées ici peuvent se connecter.
6. Dans *APIs & Services → Credentials*, cliquez **Create Credentials → OAuth client ID**,
   type **Web application**.
7. Dans *Authorized redirect URIs*, ajoutez ces trois adresses, exactement :
   - `https://zelicall.com/api/integrations/google/callback`
   - `https://sophie-ia-xynoltd1.vercel.app/api/integrations/google/callback`
   - `http://localhost:3000/api/integrations/google/callback`

   La deuxième est l'adresse d'origine de Vercel. La garder permet de continuer à tester
   si le domaine n'est pas encore actif.
8. Validez. Google affiche un **Client ID** et un **Client secret**.
9. Dans Vercel, *Settings → Environment Variables*, ajoutez :
   - `GOOGLE_OAUTH_CLIENT_ID`, type **Secret**, la valeur du Client ID ;
   - `GOOGLE_OAUTH_CLIENT_SECRET`, type **Secret**, la valeur du Client secret ;
   - `GOOGLE_OAUTH_REDIRECT_URI`, type **Secret**, la valeur
     `https://zelicall.com/api/integrations/google/callback`.

   Cette variable doit correspondre **exactement** à l'une des adresses de l'étape 7.
   Une différence d'un seul caractère fait échouer la connexion, y compris un `/` final.
10. Dans votre `.env.local`, ajoutez les trois mêmes variables, mais avec
    `GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/integrations/google/callback`.
11. Relancez un déploiement sur Vercel, en décochant « Use existing Build Cache ».
12. Ouvrez l'application, allez dans *Plus → Agenda*, et cliquez « Connecter mon agenda
    Google ».

**Limite du mode test** : Google autorise cent utilisateurs de test. Au-delà, une
vérification de l'application est nécessaire, et elle prend plusieurs semaines. À lancer
avant les premiers clients payants, pas avant.

## 3. Vapi — fournisseur de voix

À faire seulement quand vous voulez lancer le spike technique. Compte payant, avec dix
dollars de crédit offerts à l'inscription, sans carte bancaire.

1. Créez un compte sur `https://vapi.ai`, **en choisissant la région européenne**. La
   région se choisit à l'inscription et ne se change pas ensuite.
2. Vérifiez que votre tableau de bord est bien sur `dashboard.eu.vapi.ai`. S'il est sur
   `dashboard.vapi.ai`, le compte est en région américaine : recommencez.
3. Dans les paramètres du compte, créez une clé d'API privée.
4. Générez un troisième secret avec `openssl rand -base64 32`.
5. Dans Vercel, ajoutez :
   - `VOICE_API_KEY`, type **Secret**, la clé Vapi ;
   - `VOICE_WEBHOOK_SECRET`, type **Secret**, le secret généré ;
   - `VOICE_API_BASE_URL`, type **Config**, la valeur `https://api.eu.vapi.ai`.
6. Dans le tableau de bord Vapi, configurez l'authentification serveur en **HMAC SHA-256**,
   avec le même secret que `VOICE_WEBHOOK_SECRET`, et activez l'en-tête d'horodatage.
7. L'URL d'outils à déclarer est
   `https://zelicall.com/api/voice/tools`.

## 4. Twilio — numéros et SMS

À faire après le spike Vapi. **Lisez d'abord ADR-022** : l'achat d'un numéro français ou
belge exige des justificatifs d'entreprise, et le choix du modèle d'acquisition n'est pas
encore tranché.

---

# Traitements planifiés

`vercel.json` déclare une tâche toutes les quinze minutes sur
`/api/jobs/calendar-sync`. Elle rattrape les agendas dont la synchronisation a échoué ou
dont l'abonnement aux notifications a expiré.

Elle exige `CRON_SECRET`. Sans cette variable, l'endpoint répond 401 et la
synchronisation ne se fait que par les notifications de Google — qui expirent au bout de
quelques jours.

**Vérification** : après déploiement, ouvrez *Vercel → votre projet → Cron Jobs*. La tâche
doit apparaître et afficher des exécutions réussies.

# URL à déclarer chez les fournisseurs

| Fournisseur | URL | Phase |
|---|---|---|
| Supabase Auth | `https://zelicall.com/auth/callback` | 0 |
| Google OAuth | `https://zelicall.com/api/integrations/google/callback` | 3 |
| Google notifications | `https://zelicall.com/api/integrations/google/notify` | 3 |
| Vercel Cron | `https://zelicall.com/api/jobs/calendar-sync` | 3 |
| Vapi outils | `https://zelicall.com/api/voice/tools` | 4 |
| Téléphonie | `https://zelicall.com/api/webhooks/telephony` | 4 |

**Rappel** : la protection de déploiement Vercel bloque les webhooks. Avant la Phase 4, il
faudra exempter `/api/voice/*` et `/api/webhooks/*`, sinon les appels des fournisseurs
recevront une page de connexion au lieu de notre endpoint.
