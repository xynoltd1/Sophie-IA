# Sophie IA

Secrétaire virtuelle pour les artisans et professionnels de terrain. Pendant que le
professionnel travaille, Sophie répond au téléphone, comprend la demande, qualifie le
prospect, consulte les vraies disponibilités, propose un rendez-vous et centralise tout
dans une application mobile.

**Version : 0.1.0 — Phase 0 (fondations) terminée.**
Sophie ne répond pas encore au téléphone. Voir `docs/CLAUDE_HANDOFF.md` pour l'état exact.

## Démarrer

```bash
npm install
cp .env.example .env.local     # puis remplir les valeurs Supabase
npm run dev
```

L'application tourne sur http://localhost:3000

### Ce qu'il faut avant de lancer

1. Un projet Supabase (gratuit pour le développement) : https://supabase.com
2. Dans *Project Settings → API*, copier l'URL, la clé `anon` et la clé `service_role`
   dans `.env.local`.
3. Appliquer les migrations :

```bash
npx supabase link --project-ref VOTRE_REF
npx supabase db push
```

Ou, sans la CLI : ouvrir chaque fichier de `supabase/migrations/` dans l'éditeur SQL de
Supabase, dans l'ordre des noms de fichiers.

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | build de production |
| `npm run typecheck` | vérification TypeScript |
| `npm run lint` | ESLint |
| `npm run test` | tests (Vitest) |
| `npm run check` | typecheck + lint + tests + build |
| `npm run release:zip` | archive complète de la version dans `releases/` |

## Structure

```
docs/                 mémoire du projet — à lire avant toute modification
supabase/migrations/  schéma de la base, versionné
src/app/              routes Next.js (App Router)
src/components/       design system et navigation
src/lib/              accès Supabase, session, permissions
tests/                tests unitaires et tests d'isolation multi-tenant
```

## Où lire quoi

- **Reprendre le projet** → `docs/CLAUDE_HANDOFF.md`
- **Comprendre le produit** → `docs/PRODUCT_SPEC.md`
- **Comprendre l'architecture** → `docs/ARCHITECTURE.md`
- **Pourquoi tel choix** → `docs/DECISIONS.md`
- **Déployer** → `docs/DEPLOYMENT.md`

## Licence

Propriétaire. Tous droits réservés.
