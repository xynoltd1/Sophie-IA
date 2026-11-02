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

## Surfaces publiques ajoutées en 0.13.0

Trois chemins sont accessibles sans session. Chacun existe pour une raison précise, et
chacun est réduit au strict nécessaire.

### `/rdv/<jeton>` — réponse du client à une proposition d'horaire

Le client n'a pas de compte et n'en aura jamais. Le jeton fait 64 caractères aléatoires,
expire en sept jours, et ne vaut que pour un rendez-vous.

La page n'affiche que le nom de l'entreprise, l'objet, l'ancien et le nouvel horaire. La
fonction SQL qui l'alimente ne renvoie **ni téléphone, ni adresse, ni notes** : un test
échoue si l'un de ces mots apparaît dans son corps. Un lien reçu par SMS peut être
transféré ou lu sur un écran verrouillé ; il ne doit jamais devenir une fiche client.

La page porte `robots: index: false`.

### `/invitation/<jeton>` — rejoindre une entreprise

Rien n'est fait au chargement : l'adhésion passe par un bouton. Un aperçu de messagerie qui
visite le lien ne doit faire entrer personne.

Le contrôle qui compte est le dernier de la chaîne : **l'adresse du compte connecté doit
être celle de l'invitation**. Sans lui, un lien transféré ferait entrer n'importe qui.

### Webhooks (`/api/voice`, `/api/messaging`, `/api/jobs`)

Ils s'authentifient par signature ou par secret partagé, jamais par session. Les exclure du
contrôle de session est délibéré : une redirection HTML renvoyée à un webhook serait lue
comme un succès par l'émetteur, qui n'essaierait plus.

Les travaux planifiés acceptent deux secrets, comparés à temps constant : celui de
l'hébergeur et un secret de déclenchement manuel.

## Espace d'administration de la plateforme

Deux chemins d'autorisation séparés de bout en bout : `is_platform_admin()` (colonne du
profil) et `is_org_member()` (appartenance à une organisation). Aucune policy ne mélange les
deux, pour qu'une faille dans l'un n'ouvre pas l'autre.

Deux pages d'administration utilisent la clé de service, parce que le super administrateur
n'est membre d'aucune organisation et que RLS les lui cacherait toutes. **La garde
applicative est alors la seule protection** : elle est donc la première instruction de
chaque page, et un test le vérifie.

Aucun accès aux enregistrements ni aux transcriptions depuis cet espace (ADR-033). Un test
parcourt tout le code de `/admin` et échoue s'il y trouve `recording_path` ou le nom du
bucket audio.

Toute écriture de la plateforme est journalisée dans `audit_logs`, qui n'est jamais exposé
aux entreprises.

## Données personnelles ajoutées en 0.13.0

| Donnée | Où | Rétention |
|---|---|---|
| Transcription | `call_transcript_segments` | pas de purge automatique à ce jour |
| Rapport brut du fournisseur | `call_events` | 30 jours, purge par travail planifié |
| Enregistrement audio | bucket privé | selon le réglage de l'entreprise, 30 jours au plus |
| Corps des SMS | `outbound_messages`, `conversation_messages` | pas de purge automatique à ce jour |

**Écart connu** : la transcription et les SMS n'ont pas encore de politique de purge. Ils
contiennent nom, adresse et problème d'un client. À trancher avant la mise en production
(voir `LEGAL_COMPLIANCE.md`, et ADR-018 sur les durées de conservation).
