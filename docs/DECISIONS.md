# Décisions d'architecture

Une décision par entrée. On n'efface jamais une décision : on la remplace par une
nouvelle qui indique laquelle elle supersède.

---

## ADR-001 — Next.js App Router, sans back-end séparé
**Date** 2026-09-07 · **Statut** acceptée

Le cahier des charges impose Next.js et Vercel. Un back-end distinct ajouterait un
déploiement, une authentification inter-services et une latence, sans bénéfice à ce
stade. Les Route Handlers et les Server Actions couvrent tous les besoins, y compris les
webhooks entrants.

*Conséquence* : la logique métier vit dans `src/lib`, jamais dans les composants, pour
rester extractible si un service dédié devenait nécessaire.

---

## ADR-002 — La conversation vocale ne transite pas par Vercel
**Date** 2026-09-07 · **Statut** acceptée

Une fonction serverless ne peut pas maintenir un flux média temps réel. Le média est donc
échangé directement entre le fournisseur de téléphonie et le fournisseur Voice IA. Notre
application n'expose que des **outils métier** en HTTP, appelés pendant la conversation.

C'est la décision la plus structurante du projet. Elle contraint le choix du fournisseur
Voice : il doit pouvoir appeler des outils HTTP externes pendant l'appel.

*Conséquence* : `SophieEngine` est un ensemble d'endpoints courts, authentifiés et
idempotents, pas un processus.

---

## ADR-003 — Isolation par RLS PostgreSQL, pas par filtre applicatif
**Date** 2026-09-07 · **Statut** acceptée

Un filtre `where organization_id = …` oublié une seule fois expose les données d'un
client à un autre. RLS place la barrière dans la base : l'oubli devient impossible.

*Coût accepté* : chaque nouvelle table demande une migration de policies, et le débogage
d'une policy est moins immédiat qu'un filtre en TypeScript.

---

## ADR-004 — Fonctions d'autorisation en `SECURITY DEFINER`
**Date** 2026-09-07 · **Statut** acceptée

Les policies de `organization_members` doivent lire `organization_members`, ce qui crée
une récursion RLS infinie. Les fonctions `is_org_member` et `org_role` contournent RLS.

*Garde-fous* : `search_path` figé, filtrage systématique sur `auth.uid()`, retour limité à
un booléen ou un rôle.

---

## ADR-005 — Création d'organisation via une fonction SQL
**Date** 2026-09-07 · **Statut** acceptée

Problème d'amorçage : on ne peut pas être membre d'une organisation inexistante. Deux
options : ouvrir une policy INSERT permissive sur `organizations`, ou passer par une
fonction. La fonction est retenue — elle crée l'organisation, l'appartenance `OWNER` et
l'activité dans une seule transaction, et laisse `organizations` sans aucune policy
INSERT.

---

## ADR-006 — Organisation active en cookie, jamais comme autorisation
**Date** 2026-09-07 · **Statut** acceptée

Le cookie `sophie_org` est un confort de navigation. Sa valeur est toujours confrontée à
`my_organizations()`. Un cookie falsifié ne donne accès à rien.

---

## ADR-007 — Suppression logique pour les entités métier
**Date** 2026-09-07 · **Statut** acceptée

Un rendez-vous annulé, une organisation fermée, un lead perdu restent en base
(`deleted_at`, ou un état dédié). Le produit repose sur l'historique : « qui a dit quoi,
quand ». Le droit à l'effacement (RGPD) est traité par une procédure d'effacement
explicite, distincte de l'annulation métier.

---

## ADR-008 — Polices auto-hébergées via npm
**Date** 2026-09-07 · **Statut** acceptée

`next/font/google` télécharge les polices au moment du build. Les paquets
`@fontsource-variable/*` les embarquent dans `node_modules`. Le build devient hermétique,
donc reproductible en CI et hors ligne, et aucune requête utilisateur ne part vers Google
(un point RGPD réel).

---

## ADR-009 — Deux familles typographiques
**Date** 2026-09-07 · **Statut** acceptée

Bricolage Grotesque pour les titres et les chiffres, Inter pour l'interface. La distinction
est nette, ce qui aide un utilisateur pressé à repérer la hiérarchie d'un écran. La couleur
est réservée au statut (urgent, à valider, fait) et n'est jamais décorative.

---

## ADR-010 — Tests d'isolation contre une vraie base
**Date** 2026-09-07 · **Statut** acceptée

Ce qu'on teste, ce sont les policies PostgreSQL : un mock ne prouverait rien. La suite
`tests/multi-tenant-isolation.test.ts` s'exécute contre un projet Supabase de
développement, et se marque **ignorée** — jamais verte — quand les variables
`SUPABASE_TEST_*` sont absentes.

---

## ADR-011 — Pays configurable dès l'origine
**Date** 2026-09-07 · **Statut** acceptée

Indicatif téléphonique, fuseau horaire, devise et surtout **droit applicable à
l'enregistrement des appels** varient. Ces valeurs sont des colonnes de `organizations`,
jamais des constantes. Cinq pays sont proposés au départ ; en ajouter un est une donnée,
pas du code.

---

## ADR-012 — Types de base maintenus à la main en Phase 0
**Date** 2026-09-07 · **Statut** acceptée, à revoir en Phase 1

`supabase gen types` nécessite un projet Supabase existant. Tant qu'il n'y en a pas,
`src/types/database.ts` est écrit à la main pour que `npm run typecheck` reste utile.

*À faire dès que le projet Supabase existe* : régénérer et remplacer.

---

## ADR-013 — Enregistrement audio conservé 30 jours maximum
**Date** 2026-09-07 · **Statut** acceptée · **Décidée par** le porteur du projet

L'audio original des appels est conservé **30 jours au maximum**, puis supprimé
automatiquement. La transcription, le résumé et l'extraction structurée survivent à cette
suppression.

*Pourquoi conserver l'audio du tout* : un artisan qui accepte un rendez-vous pris par une
IA a besoin, au moins une fois, de pouvoir vérifier ce que le client a réellement dit.
Sans lecteur audio, une erreur de transcription sur une adresse ou un numéro devient
invérifiable, et la confiance dans le produit ne s'installe pas.

*Pourquoi seulement 30 jours* : au-delà, l'audio ne sert plus à vérifier un rendez-vous
récent ; il ne fait qu'accumuler des données personnelles de tiers — les clients de nos
clients — qui n'ont pas choisi ce produit. Une durée courte et automatique est la posture
la plus défendable devant une autorité de contrôle.

*Mise en œuvre* :
- `organizations.audio_retention_days`, plafonné à 30 par une contrainte **en base** :
  aucun chemin de code ne peut le contourner ;
- `recording_enabled` est `false` par défaut, et ne peut passer à `true` qu'après
  acceptation d'une charte (`recording_policy_accepted_at`), garantie par une contrainte ;
- `audio_retention_events` conserve la trace des purges, pour pouvoir prouver la
  suppression sans conserver ce qui a été supprimé ;
- la purge elle-même est un job planifié de la Phase 5.

*Ce que cette décision ne change pas* : la transcription reste une donnée personnelle. Le
passage à une rétention courte réduit le risque, il ne supprime ni l'obligation d'informer
l'appelant, ni la limitation de durée sur la transcription, ni les contrats de
sous-traitance.

---

## ADR-014 — Lancement limité à la France et à la Belgique
**Date** 2026-09-07 · **Statut** acceptée · **Décidée par** le porteur du projet

L'onboarding ne propose que deux pays. La liste n'est pas une contrainte technique — le
pays est une donnée (ADR-011) — mais une contrainte de conformité : on n'ouvre un pays
qu'après avoir vérifié ce qui y est exigé pour l'enregistrement des appels.

*Conséquence opérationnelle* : ajouter un pays est une décision juridique avant d'être une
ligne de code. Voir `docs/SECURITY.md`, section « Enregistrement des appels ».

---

## ADR-015 — Le texte d'annonce téléphonique est une donnée, pas du code
**Date** 2026-09-07 · **Statut** acceptée

Le texte lu à l'appelant avant l'enregistrement varie selon le pays, la langue et
l'entreprise, et il sera corrigé par un juriste — pas par un développeur. Il est donc
stocké dans `recording_notice_templates` et résolu au moment de l'appel par
`resolve_recording_notice()`.

Chaque modèle porte `is_legally_validated`, **faux par défaut**, et ne peut passer à vrai
sans indiquer qui l'a validé et quand (contrainte en base).

*Garde-fou* : `recording_allowed(org_id, is_test)` refuse l'enregistrement d'un appel réel
si le modèle applicable n'est pas validé. Les appels marqués `is_test = true` restent
autorisés — ils n'engagent aucun tiers réel, ce qui permet au développement de continuer.

*Pourquoi en base et pas dans le code* : un contrôle applicatif peut être contourné par un
oubli lors d'un refactoring. Ici, le pire scénario — enregistrer un vrai client sans
annonce valide — est rendu impossible par PostgreSQL.

---

## ADR-016 — Trois états de maturité distincts
**Date** 2026-09-07 · **Statut** acceptée · **Décidée par** le porteur du projet

Le projet distingue `TECHNICALLY READY`, `LEGAL REVIEW REQUIRED` et `PRODUCTION READY`.
Voir `docs/LEGAL_COMPLIANCE.md` pour les définitions.

Une version peut être irréprochable techniquement et rester interdite de production. Le
développement des phases 1 à 8 n'est pas bloqué par la conformité ; c'est la mise en
service avec de vrais clients, de vrais appels et de vrais enregistrements qui l'est.

*Conséquence sur la procédure de fin de phase* : chaque livraison annonce explicitement
son état. Aucune ne peut être déclarée `PRODUCTION READY` sur la seule foi des tests.

---

## ADR-017 — Registre des sous-traitants tenu avant l'intégration
**Date** 2026-09-07 · **Statut** acceptée

Toute nouvelle intégration traitant des données de tiers est ajoutée au registre de
`docs/LEGAL_COMPLIANCE.md` (point L2) **avant** d'être branchée. Une intégration absente du
registre ne doit pas atteindre la production.

*Décisions ouvertes à ce jour* : la région d'hébergement du fournisseur de téléphonie, du
fournisseur Voice et du fournisseur IA post-appel est inconnue tant que ces prestataires
ne sont pas choisis. Ce n'est pas un oubli à combler par une hypothèse : c'est une
question ouverte, documentée comme telle, à trancher pendant la Phase 3.

---

## ADR-018 — Durées de conservation autres que l'audio : décision ouverte
**Date** 2026-09-07 · **Statut** ouverte

Seule la durée de l'audio est fixée (30 jours, ADR-013). Les durées applicables à la
transcription, au résumé, aux contacts, aux journaux d'audit et aux comptes résiliés ne
sont **pas** décidées.

Une durée non fixée n'est pas une durée illimitée : c'est un point bloquant de la
checklist (L5). Aucune valeur ne sera inventée par l'équipe technique. En attendant, les
migrations prévoient les colonnes nécessaires sans imposer de valeur par défaut autre que
« conservation jusqu'à décision ».

---

## ADR-019 — Le mode test est une propriété de l'organisation, pas de l'appel
**Date** 2026-09-07 · **Statut** acceptée · **Décidée par** le porteur du projet

Jusqu'ici, `is_test` était déclaratif : n'importe quel appel pouvait être marqué « test »
et échapper ainsi à l'exigence d'annonce validée (ADR-015). Le scénario redouté était
banal — « on laisse tourner deux jours sur le vrai numéro, juste pour voir » — et suffisait
à enregistrer un vrai client sans annonce valide.

Désormais, seule une organisation portant `is_test_organization = true` peut produire des
appels de test. Ailleurs, le drapeau est **ignoré** : l'appel est traité comme réel et
l'annonce validée redevient obligatoire.

*Mise en œuvre* :
- `organizations.is_test_organization`, faux par défaut ;
- un trigger réserve la bascule à l'administration de la plateforme — sans lui, un
  propriétaire pourrait cocher la case lui-même, la policy UPDATE l'autorisant à modifier
  son organisation ;
- une contrainte impose de savoir qui a activé le mode test et quand ;
- `call_is_test(org_id, requested_test)` est la seule qualification qui fasse foi ;
- `recording_allowed()` s'appuie dessus.

*Ce que cela transforme* : une convention d'équipe devient une garantie de la base. Une
erreur de configuration ne peut plus produire l'enregistrement d'un tiers réel sans annonce.

*Ce que cela ne fait pas* : rien n'empêche techniquement quelqu'un d'appeler le numéro
d'une organisation d'essai. La règle reste humaine — une organisation de test ne reçoit
que des appels de personnes prévenues — mais elle n'est plus la seule barrière.

---

## ADR-020 — Fournisseur de voix : Vapi en région européenne, avec trunk SIP apporté
**Date** 2026-09-24 · **Statut** acceptée, sous réserve de validation par le spike

### Le choix

Architecture retenue : **opérateur téléphonique (Twilio) → trunk SIP → Vapi région UE →
outils HTTP vers notre backend**, le tout derrière l'abstraction `VoiceAIProvider`.

Deux architectures ont été comparées, conformément à la demande :

- **A** — opérateur/SIP + Vapi + outils HTTP vers notre backend
- **B** — opérateur/SIP + OpenAI Realtime directement + function calling

### Ce qui tranche, et ce n'est pas la quantité de code

**L'option B est incompatible avec notre contrainte d'hébergement.** L'API Realtime
d'OpenAI en mode SIP exige qu'un de nos processus maintienne une connexion WebSocket
ouverte **pendant toute la durée de l'appel**. Les fonctions Vercel s'arrêtent à 300
secondes par défaut, 800 au maximum en offre Pro. Un appel d'artisan de plus de cinq
minutes est banal.

L'option B imposerait donc un second hébergeur avec un processus permanent — exactement
ce que le cahier des charges écarte (« Ne suppose pas qu'un processus Node permanent
tourne en arrière-plan ») et ce que l'ADR-002 a acté dès le premier jour.

Avec Vapi, notre backend ne reçoit que des requêtes HTTP courtes, avec un délai
d'attente de 20 secondes par défaut. C'est le modèle serverless sans compromis.

### Comparaison détaillée

| Critère | A — Vapi | B — OpenAI Realtime |
|---|---|---|
| Compatible Vercel serverless | oui, HTTP court | **non, WebSocket persistante** |
| Simplicité d'intégration | assistant en JSON + endpoints | orchestration complète à écrire |
| Latence mesurée (tiers) | 720 ms médiane, 1 050 ms P95 | aucune mesure SIP publiée |
| Voix française | multi-fournisseur, substituable | voix OpenAI imposée, qualité fr non vérifiée |
| Tool calling | délai 20 s, politique de reprise, contrat d'erreur documenté | délai et concurrence non documentés |
| Appels entrants multi-tenant | un numéro = un assistant | un seul projet, routage à écrire |
| Transfert vers un humain | sept modes, dont transfert avec résumé | transfert aveugle seulement |
| Enregistrement | activable, **bucket Supabase supporté nativement** | à capturer soi-même |
| Sécurité des appels d'outils | HMAC + horodatage + liste d'IP autorisées | à construire |
| Observabilité | tableau de bord + traçage | à construire |
| Dépendance fournisseur | moyenne, atténuée (SIP, clés et stockage apportés) | élevée (modèle **et** voix) |
| Coût estimé par minute | 0,12 à 0,25 $ | 0,06 à 0,20 $ **plus** un runtime externe |
| Résidence des données | région UE complète ; sous-traitants à auditer | traitement UE confirmé sur l'endpoint Realtime |

### Ce que le choix coûte, dit franchement

L'option B serait moins chère sur le papier : environ 0,08 $ de moins par minute, soit
près de 16 $ par mois pour un artisan à 200 minutes. Cet écart est réel.

Il est absorbé par le coût du second hébergeur, par les semaines de développement de
l'orchestration (interruptions, détection de fin de phrase, messages d'attente,
reprises), et par la maintenance permanente de cette couche. À l'échelle d'un produit qui
n'a pas encore de client, ce n'est pas un arbitrage économique, c'est un arbitrage de
risque.

### Ce que Vapi livre et que nous n'aurons pas à écrire

Quatre exigences du cahier des charges sont satisfaites par configuration plutôt que par
développement : l'enregistrement vers notre propre bucket Supabase privé (sections 13 et
40), le transfert avec résumé pour les urgences (section 27), l'authentification des
appels d'outils par HMAC avec protection contre le rejeu (section 41), et le traçage
(section 54).

### Garde-fous

1. `VoiceAIProvider` est écrit avant toute ligne de code Vapi. Nos outils métier sont des
   endpoints HTTP neutres : c'est l'actif qui survivra à un changement de fournisseur.
2. Trunk SIP apporté par nous : le numéro et l'opérateur nous appartiennent, une
   migration n'oblige pas à porter les numéros.
3. Clés des fournisseurs de transcription et de voix apportées par nous quand c'est
   possible.
4. Enregistrements et transcriptions écrits dans **notre** bucket Supabase, jamais
   laissés chez le fournisseur — dont la rétention par défaut est de 14 à 180 jours selon
   l'offre, ce qui ne correspond pas à notre politique de 30 jours (ADR-013).

### Plan de repli

Si Vapi déçoit, l'ordre de préférence est : **LiveKit Agents** auto-hébergé en UE
(contrôle total, mais infrastructure à exploiter), puis **Telnyx AI Voice Agents** (un
seul fournisseur pour les numéros et l'agent, meilleure latence réseau mesurée, mais
résidence UE et qualité française non documentées).

### Ce qui reste à vérifier avant engagement

- **Quels fournisseurs de transcription, de modèle et de voix traitent réellement en
  UE chez Vapi.** La documentation de la région européenne ne le précise pas. Router par
  Vapi UE ne garantit pas que la chaîne complète reste en Europe. À auditer fournisseur
  par fournisseur et à inscrire au registre des sous-traitants (L2).
- **La qualité de la prosodie française.** Aucune source ne permet d'en juger. Cinq à dix
  appels d'écoute réels avant de figer la voix.
- **Le spike technique** décrit ci-dessous.

---

## ADR-021 — Les jetons d'agenda sont chiffrés par l'application
**Date** 2026-09-24 · **Statut** acceptée

Un jeton de rafraîchissement Google donne un accès durable à l'agenda d'un client. Trois
mesures, dans cet ordre d'importance :

1. **Privilèges au niveau colonne.** La migration 0016 accordait `select` sur toute la
   table `calendar_connections` à `authenticated`, avec une policy ouverte à tous les
   membres — un membre connecté pouvait donc lire les jetons de son organisation. Le
   commentaire du fichier affirmait l'inverse. La migration 0017 révoque ce privilège et
   ne réaccorde que les colonnes non sensibles.
2. **Chiffrement applicatif** en AES-256-GCM, clé dans `SECRETS_ENCRYPTION_KEY`, hors de
   la base. Une copie de la base, une sauvegarde égarée ou une clé `service_role`
   compromise ne suffisent plus à obtenir les jetons.
3. **Journalisation** de chaque connexion, déconnexion et révocation dans `audit_logs`.

*Leçon générale* : un commentaire qui affirme une propriété de sécurité ne la garantit
pas. Cette faille est passée à travers une relecture parce que l'intention était écrite
juste à côté du code qui la contredisait.

---

## ADR-022 — Acquisition des numéros de téléphone : décision ouverte
**Date** 2026-09-24 · **Statut** **ouverte — décision produit et juridique requise**

La recherche a mis au jour une contrainte réglementaire qui touche le modèle commercial,
indépendamment du fournisseur de voix retenu.

**France** : un numéro géographique ou mobile exige une adresse en France, un extrait
K-bis, un SIREN/SIRET et l'identité d'un représentant.

**Belgique** : plus strict encore — l'adresse doit se situer **dans la zone couverte par
l'indicatif du numéro**, avec extrait BCE et numéro de TVA belge.

Deux modèles possibles, et ils ne se valent pas :

- **Numéros détenus par Sophie IA**, l'artisan renvoyant sa ligne existante vers le
  numéro fourni. Onboarding simple, mais exige une entité par pays et transfère la charge
  réglementaire sur nous.
- **Un dossier réglementaire par client.** Juridiquement plus propre, mais demande à un
  plombier de fournir un K-bis avant d'essayer le produit — ce qui tue l'inscription.

**Aucune de ces options ne sera choisie sans vous.** Elle engage une structure
juridique, un coût, et le discours commercial. Voir aussi le point L8 de
`LEGAL_COMPLIANCE.md`.

---

## ADR-023 — Domaine de production : zelicall.com
**Date** 2026-10-13 · **Statut** acceptée

Le domaine **zelicall.com** a été acheté et devient l'adresse de production.

*Aucun changement de code.* Toutes les adresses étaient déjà lues depuis des variables
d'environnement ; l'ancienne adresse n'apparaissait que dans la documentation. C'est ce
qui rend ce changement gratuit, et c'est la raison pour laquelle aucune URL ne doit jamais
être écrite en dur dans le code.

L'adresse d'origine de Vercel reste active et sert de secours. Les deux sont déclarées
chez Google, ce qui permet de continuer à tester si le domaine n'est pas encore propagé.

*Trois endroits à mettre à jour hors du code*, et les oublier casse la connexion :
`NEXT_PUBLIC_APP_URL` sur Vercel, les URL de redirection dans Supabase Auth, et les URI
autorisés dans Google Cloud.

**Question ouverte** : zelicall.com est-il le nom commercial du produit, Sophie restant le
prénom de l'assistante ? Le code, les documents et l'interface disent aujourd'hui
« Sophie IA » partout. Un changement de nom est une décision produit, pas une correction
technique : il n'a pas été fait.

---

## ADR-024 — La fraîcheur de l'agenda vient de la demande, pas de la tâche planifiée

**Date** 2026-10-14 · **Statut** acceptée

### Ce qui s'est passé

La version 0.5.1 déclarait une tâche planifiée de synchronisation d'agenda toutes les
quinze minutes. Le déploiement a été **refusé par Vercel**, avec ce motif :

> Hobby accounts are limited to daily cron jobs. This cron expression would run more than
> once per day.

`typecheck`, `lint`, `test` et `build` étaient tous verts en local. Aucun d'eux ne pouvait
voir le problème : il ne s'agit pas de code, mais d'une règle du compte, appliquée avant
la compilation. La conséquence a été qu'une version livrée comme terminée n'a jamais pu
être mise en ligne, et que la fonctionnalité Google Calendar a semblé absente du produit
alors qu'elle était écrite.

### Pourquoi ralentir la tâche ne suffisait pas

`calendar_sync_state` (migration 0017) ne considère un agenda comme fiable que s'il a été
relu il y a moins de trente minutes. Au-delà, l'application se déclare incapable de
garantir un créneau et Sophie refuse d'en proposer — c'est voulu (sections 19 et 43).

Une synchronisation quotidienne aurait donc laissé l'agenda « périmé » environ
vingt-trois heures sur vingt-quatre. Sophie aurait refusé presque tous les rendez-vous,
sans que rien n'ait l'air cassé. L'erreur se serait déplacée d'un échec visible vers une
dégradation silencieuse, ce qui est pire.

### Décision

La synchronisation a lieu **au moment où une réponse en dépend** :

- à l'ouverture de la page Agenda ;
- avant tout `check_availability` appelé par Sophie pendant un appel.

`ensureCalendarFresh()` ne synchronise que si les données sont réellement périmées,
abandonne au bout de six secondes, ignore une connexion qui échoue en boucle, et ne lève
jamais. Un échec se traduit par un agenda marqué périmé — une situation déjà prévue.

La tâche planifiée reste, à raison d'une fois par jour. Elle ne garantit plus la fraîcheur :
elle rattrape les connexions que personne n'a consultées.

### Conséquences

Cette architecture ne dépend plus du plan Vercel. Passer en Pro permettrait de resserrer la
tâche, mais ne changerait rien au fonctionnement. Elle consomme aussi moins : on
synchronise quand quelqu'un regarde, pas toutes les quinze minutes pour rien.

Contrepartie assumée : la première ouverture de l'agenda après une longue absence peut
attendre jusqu'à six secondes. Pendant un appel, le délai joue contre nous — d'où
l'abandon, qui fait basculer Sophie sur « le professionnel vous confirmera ».

### Garde-fou

`tests/vercel-config.test.ts` échoue si `vercel.json` déclare une tâche plus fréquente que
quotidienne. C'est le seul contrôle local capable d'attraper cette classe d'erreur. La
constante `PLAN` en tête du fichier est à changer le jour où le compte passe en Pro.

### Leçon

Une suite de tests verte ne dit rien des règles de la plateforme d'hébergement. Les limites
du plan (fréquence des tâches, régions, durée d'exécution) appartiennent à la configuration
de déploiement et doivent être vérifiées explicitement, comme n'importe quelle autre
contrainte.


---

## ADR-025 — Une contrainte d'unicité destinée à un upsert porte sur des colonnes, jamais sur une expression

**Date** 2026-10-14 · **Statut** acceptée

### Ce qui s'est passé

La connexion d'un agenda Google échouait à la toute dernière étape. Google acceptait, les
jetons étaient en main, et l'enregistrement en base était rejeté :

> there is no unique or exclusion constraint matching the ON CONFLICT specification

La migration 0016 garantissait l'unicité par un index sur **expression** :

```sql
create unique index calendar_connections_unique_idx
  on calendar_connections (
    organization_id,
    coalesce(member_id, '000...'::uuid),
    provider
  );
```

Le `coalesce` était là pour une bonne raison : en SQL deux `NULL` ne sont pas égaux, donc
un index unique ordinaire aurait laissé passer plusieurs connexions « sans intervenant
désigné » dans une même organisation.

Mais PostgreSQL ne déduit un index que si l'expression passée à `ON CONFLICT` correspond
exactement à celle de l'index. Le code écrivait trois noms de colonnes nus. L'index
existait, il garantissait bien l'unicité voulue, et il était inutilisable pour un upsert.

### Décision

`nulls not distinct` (PostgreSQL 15+) donne la même sémantique — deux `NULL` comptent
comme égaux — avec un index sur colonnes simples, donc déductible (migration 0018).

Règle générale : **une contrainte d'unicité qui sert de cible à un upsert porte sur des
colonnes.** Si une expression est indispensable, le code lit puis écrit, il ne fait pas
d'upsert.

### Garde-fou

`tests/upsert-constraints.test.ts` relie le code aux migrations : pour chaque `onConflict`
trouvé dans `src/`, il exige une contrainte unique sur colonnes simples dans
`supabase/migrations/`. Un index contenant une parenthèse — donc un appel de fonction —
est rejeté. Ce test a été vérifié dans les deux sens : il échoue sur l'état d'avant la
migration 0018, il passe après.

### La seconde erreur, et sa correction

L'interface affichait « La connexion a échoué. Réessayez. » alors que le code connaissait
le motif exact. Comprendre a demandé d'ouvrir `audit_logs` à la main. `connectCalendar`
renvoie désormais un motif (`ECHANGE_REFUSE`, `SANS_RENOUVELLEMENT`, `ENREGISTREMENT`) et
l'écran dit quoi faire — recommencer, révoquer l'accès chez Google, ou constater que le
problème vient de nous. Le cas « pas de jeton de rafraîchissement » n'était en outre pas
journalisé du tout : il l'est maintenant.

### Leçon

Ces deux erreurs partagent une cause. Un contrôle qui n'est jamais exécuté contre la
réalité ne prouve rien : ni l'index, ni le message d'erreur ne pouvaient échouer avant
qu'un vrai agenda soit connecté. Les chemins qui ne s'exécutent qu'en présence d'un service
externe doivent être couverts par un contrôle statique quand un test réel est impossible.
