# Sécurité

## Modèle de menace

| Menace | Barrière |
|---|---|
| Une entreprise lit les données d'une autre | RLS PostgreSQL (ADR-003) |
| Un membre agit au-delà de son rôle | policies par rôle + RBAC applicatif |
| Un utilisateur se promeut administrateur plateforme | policy UPDATE sur `profiles` qui fige `is_platform_admin` |
| Cookie d'organisation falsifié | valeur toujours confrontée à `my_organizations()` |
| Webhook falsifié (téléphonie, voix) | signature vérifiée avant tout traitement (Phase 4) |
| Fuite d'un enregistrement audio | bucket privé, URL signées courtes, accès journalisé (Phase 5) |
| Secret exposé au navigateur | `service_role` derrière `server-only`, jamais préfixée `NEXT_PUBLIC_` |
| Redirection ouverte après connexion | seules les destinations commençant par `/` sont acceptées |

## Règles non négociables

1. **Aucun secret dans Git.** `.env*` est ignoré ; `.env.example` ne contient que des noms
   de variables.
2. **`SUPABASE_SERVICE_ROLE_KEY` est serveur uniquement.** Le module qui la lit importe
   `server-only` : la compilation échoue s'il est atteint depuis le navigateur.
3. **Toute utilisation du client d'administration** est précédée d'un contrôle
   d'autorisation explicite et suivie d'une écriture dans `audit_logs`.
4. **`getUser()`, jamais `getSession()`** pour une décision d'autorisation :
   `getUser()` valide le jeton auprès de Supabase.
5. **Message d'erreur identique** pour un e-mail inconnu et un mot de passe faux : ne pas
   révéler quels comptes existent.
6. **Toute nouvelle table avec `organization_id`** reçoit RLS et ses policies dans la même
   migration.

## En-têtes HTTP

Définis dans `next.config.ts` : `X-Content-Type-Options`, `Referrer-Policy`,
`X-Frame-Options`, `Permissions-Policy` (caméra et micro refusés).

## Ce qui n'est pas encore fait

À traiter dans les phases indiquées, et à ne pas oublier :

- **Phase 4** — vérification de signature des webhooks ; limitation de débit sur les
  endpoints publics ; protection contre le rejeu.
- **Phase 5** — accès audio : vérification d'organisation, URL signée de courte durée,
  écriture dans `audit_logs` à chaque écoute.
- **Phase 7** — la console plateforme ne donne **pas** un accès libre aux audios clients :
  accès motivé, limité dans le temps, systématiquement journalisé.
- **Phase 8** — Content-Security-Policy stricte, protection CSRF sur les Route Handlers
  mutatifs, revue de dépendances, procédure de sauvegarde et de restauration testée,
  export et effacement des données à la demande.

## Réponse à incident

En cas de fuite de clé : régénérer la clé dans Supabase, mettre à jour les variables
Vercel, redéployer, puis consulter `audit_logs` sur la période concernée. La rotation de
`service_role` invalide immédiatement tous les usages.

---

## Enregistrement des appels — France et Belgique

> Cette section décrit ce qui est **implémenté** et ce qui reste **à faire valider par un
> juriste**. Elle n'est pas un avis juridique et ne remplace pas une validation
> professionnelle avant commercialisation.

### Ce que le produit fait

- L'enregistrement est **désactivé par défaut**. C'est un choix explicite de l'entreprise
  cliente, jamais un réglage hérité.
- Il ne peut être activé qu'après acceptation d'une charte de traitement
  (`recording_policy_accepted_at`), garantie par une contrainte en base.
- L'audio original est conservé **30 jours au maximum**, plafond appliqué par une
  contrainte `check` en base, pas par le code applicatif.
- Une annonce à l'appelant est requise par défaut (`recording_notice_required = true`) et
  son texte est personnalisable.
- Chaque purge laisse une trace dans `audio_retention_events` : on peut prouver la
  suppression sans conserver ce qui a été supprimé.
- La transcription et le résumé survivent à la purge de l'audio.

### Ce qui reste à faire

**Phase 5** — le job de purge lui-même, la suppression effective dans Supabase Storage, et
la journalisation de chaque écoute dans `audit_logs`.

**Avant les premiers clients réels** — quatre chantiers non techniques :

1. **Rôles RGPD.** L'entreprise cliente est responsable de traitement, Sophie IA est
   sous-traitant. Il faut un contrat de sous-traitance type, signé à l'inscription.
2. **Sous-traitants ultérieurs.** Les fournisseurs de voix, de transcription et d'IA
   traitent des conversations de tiers. Chacun demande un contrat, et leur localisation
   (hébergement hors UE) doit être vérifiée.
3. **Annonce à l'appelant.** L'information doit précéder l'enregistrement, indiquer la
   finalité et la possibilité de s'y opposer. Le texte par défaut de
   `src/lib/org/recording.ts` est une base de travail, pas un texte validé.
4. **Droits des personnes.** L'appelant peut demander l'accès à son enregistrement ou son
   effacement avant les 30 jours. Une procédure doit exister — le champ `reason` de
   `audio_retention_events` prévoit déjà `USER_REQUEST`.

### Points de vigilance propres à chaque pays

**France.** La CNIL attend que l'enregistrement soit justifié par une finalité précise,
proportionné, annoncé, et conservé une durée courte. Un enregistrement systématique et
conservé longtemps est le cas typiquement contesté ; une durée de 30 jours avec purge
automatique va dans le sens attendu. À faire vérifier : la formulation de l'annonce et la
tenue du registre des traitements de l'entreprise cliente.

**Belgique.** L'enregistrement d'une conversation à laquelle on participe ne constitue pas
en soi une infraction pénale, mais le RGPD s'applique intégralement, sous le contrôle de
l'Autorité de protection des données. Les obligations pratiques sont donc très proches de
celles applicables en France.

Dans les deux cas : ne pas ouvrir un troisième pays sans refaire cette vérification.
