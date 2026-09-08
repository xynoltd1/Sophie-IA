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
