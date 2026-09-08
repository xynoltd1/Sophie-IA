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
   - Redirect URLs : `<URL>/auth/callback`.
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

## URL à déclarer chez les fournisseurs (phases suivantes)

| Fournisseur | URL | Phase |
|---|---|---|
| Supabase Auth | `<URL>/auth/callback` | 0 |
| Google OAuth | `<URL>/api/integrations/google/callback` | 3 |
| Téléphonie | `<URL>/api/webhooks/telephony` | 4 |
| Voice IA | `<URL>/api/webhooks/voice` | 4 |
| Vercel Cron | `<URL>/api/jobs/run` | 5 |

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
