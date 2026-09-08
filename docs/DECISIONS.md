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
