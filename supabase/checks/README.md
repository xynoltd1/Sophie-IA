# Scripts de vérification

Scripts en **lecture seule**, à coller dans l'éditeur SQL de Supabase. Ils ne modifient
rien et peuvent être exécutés autant de fois que nécessaire.

| Script | Ce qu'il vérifie |
|---|---|
| `01_verify_schema.sql` | tables, fonctions et colonnes attendues ; RLS active partout ; aucune table sans policy |
| `02_verify_content.sql` | catalogue de métiers, modèles d'annonce, garde-fous de conformité |

## Comment lire le résultat

`01` renvoie une ligne par objet attendu. Tout ce qui est marqué `MANQUANT` correspond à
une migration non appliquée — la colonne `migration` indique laquelle.

Deux contrôles de sécurité s'ajoutent en fin de liste :
- **RLS désactivé** sur une table publique : fuite de données potentielle, à corriger avant
  toute suite ;
- **aucune policy** sur une table avec RLS : soit la table est inaccessible, soit une
  migration n'a été appliquée qu'à moitié. `audit_logs` est la seule exception voulue, son
  accès étant réservé à la clé `service_role`.

`02` doit afficher zéro annonce juridiquement validée et zéro organisation avec
enregistrement actif. C'est l'état attendu tant que la
`PRE_PRODUCTION_LEGAL_CHECKLIST` n'est pas franchie.

## Ordre des migrations

Elles s'appliquent dans l'ordre alphabétique des noms de fichiers, qui est aussi l'ordre
chronologique. Ne pas en sauter une : `0011` dépend de `0009` et `0010`, et `0004` dépend
de `0003`.

```
0001_extensions_and_helpers
0002_core_identity
0003_activity_and_audit
0004_authorization_functions
0005_rls_policies
0006_audio_retention_policy
0007_recording_notice_templates
0008_test_organizations
0009_profession_templates
0010_business_configuration
0011_sophie_configuration
```

Avec la CLI, `npx supabase db push` gère l'ordre et ignore ce qui est déjà appliqué.
