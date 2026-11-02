# Audit fonctionnel de Sophie IA

**Date** 2026-11-02 · **Version auditée** 0.14.0 · **Méthode** lecture du code, des
migrations et des tests. Les affirmations des anciens documents n'ont pas été reprises
telles quelles : chaque ligne ci-dessous a été vérifiée dans le dépôt.

## Comment lire les états

| État | Ce qu'il veut dire |
|---|---|
| `COMPLETE_TESTED` | Parcours complet, exercé contre les vrais services au moins une fois |
| `IMPLEMENTED_UNTESTED` | Code complet, jamais exercé en conditions réelles |
| `BLOCKED_EXTERNAL_CONFIG` | Code complet, bloqué par un compte ou une clé absente |
| `PARTIAL` | Une partie du parcours existe, une autre manque |
| `MISSING` | Rien |

Un écran qui affiche des données sans pouvoir les modifier est `PARTIAL`, pas `COMPLETE`.

---

## 1. Fondations

| Fonctionnalité | État | Détail |
|---|---|---|
| Authentification e-mail | `COMPLETE_TESTED` | inscription, connexion, déconnexion, callback protégé contre l'open redirect |
| Multi-tenant et RLS | `COMPLETE_TESTED` | prouvé contre la vraie base le 2026-09-08 ; 16 tests d'isolation, ignorés sans `SUPABASE_TEST_*` |
| Rôles et permissions | `COMPLETE_TESTED` | OWNER / ADMIN / MEMBER, hiérarchie `outranks`, vérifiée côté serveur dans chaque action |
| PWA | `IMPLEMENTED_UNTESTED` | manifeste, icônes, bouton d'installation ; jamais installée sur un vrai téléphone à notre connaissance |
| Sondes de santé | `COMPLETE_TESTED` | `/api/health`, `/api/health/supabase` |

## 2. Entreprise et configuration

| Fonctionnalité | État | Détail |
|---|---|---|
| Onboarding en sept étapes | `COMPLETE_TESTED` | sauvegardé à chaque étape, reprenable, garde d'étape serveur |
| Catalogue de métiers | `COMPLETE_TESTED` | douze métiers, `apply_profession_template()` |
| Services | `COMPLETE_TESTED` | créés à l'inscription, **modifiables depuis les réglages depuis 0.13.0** |
| Horaires | `COMPLETE_TESTED` | idem |
| Absences et vacances | `IMPLEMENTED_UNTESTED` | écran créé en 0.13.0 ; `available_slots()` en tient compte depuis la Phase 3 |
| Configuration de Sophie (voix, style, accueil) | `PARTIAL` | réglée à l'inscription ; **aucun écran pour la modifier ensuite** |
| Connaissances de Sophie | `IMPLEMENTED_UNTESTED` | écran complet en 0.13.0 ; **Sophie ne les lit pas encore pendant l'appel** — voir § 9 |
| Enregistrement des appels | `COMPLETE_TESTED` | écran de consentement, rétention, vérifié le 2026-10-23 |

## 3. Téléphonie et conversation

| Fonctionnalité | État | Détail |
|---|---|---|
| Appel entrant, états, idempotence | `COMPLETE_TESTED` | vérifié les 22 et 23 octobre |
| Huit outils métier de Sophie | `COMPLETE_TESTED` | signature vérifiée avant lecture du corps ; erreurs métier en HTTP 200 |
| Rattachement numéro → entreprise | `BLOCKED_EXTERNAL_CONFIG` | **aucun numéro n'existe** : tous les appels tombent dans le repli « essai » |
| Déclaration d'un numéro | `MISSING` | `phone_numbers` s'écrit en SQL à la main ; aucun écran, aucun script |
| Transfert vers un humain | `IMPLEMENTED_UNTESTED` | outil déclaré, jamais déclenché en appel réel |
| Enregistrement audio conservé | `COMPLETE_TESTED` | rapatrié, servi par adresse signée, écouté le 2026-10-23 |
| Transcription | `COMPLETE_TESTED` | tour par tour, horodatée ; **qualité française insuffisante**, voir § 10 |
| Résumé et extraction | `BLOCKED_EXTERNAL_CONFIG` | produits par nous (ADR-031) ; sans `AI_API_KEY`, un résumé **simulé** s'affiche en le disant |

## 4. CRM

| Fonctionnalité | État | Détail |
|---|---|---|
| Contacts, déduplication par téléphone | `COMPLETE_TESTED` | provenance du numéro affichée (réseau / dicté) |
| Prospects et pipeline | `COMPLETE_TESTED` | six états, écrans liste et fiche |
| Tâches | `PARTIAL` | créées par Sophie, visibles sur la fiche contact et comptées sur l'accueil ; **aucun écran dédié**, aucune clôture en un geste |
| Recherche globale | `COMPLETE_TESTED` | nom, entreprise, ville, téléphone normalisé |
| Historique unifié du contact | `IMPLEMENTED_UNTESTED` | appels, messages, rendez-vous, demandes, depuis 0.13.0 |
| Liste des appels paginée et filtrée | `IMPLEMENTED_UNTESTED` | 0.14.0 : filtres en base, total juste, ordre déterministe |
| Corbeille des appels | `IMPLEMENTED_UNTESTED` | 0.14.0 : suppression logique, purge à 30 jours, audio supprimé avant la ligne |

## 5. Agenda

| Fonctionnalité | État | Détail |
|---|---|---|
| Google Calendar | `COMPLETE_TESTED` | vérifié le 2026-10-15 par un événement réel |
| Disponibilités réelles | `COMPLETE_TESTED` | horaires, rendez-vous, holds, absences, marge |
| Anti-double réservation | `COMPLETE_TESTED` | contrainte d'exclusion en base, jamais le code |
| Validation d'un rendez-vous | `IMPLEMENTED_UNTESTED` | accepter écrit dans Google ; **jamais exercé avec un vrai rendez-vous** |
| Refus avec motif | `IMPLEMENTED_UNTESTED` | 0.13.0 |
| Proposition d'un autre horaire | `IMPLEMENTED_UNTESTED` | page publique à jeton ; dépend du SMS pour que le lien arrive |
| Annulation | `IMPLEMENTED_UNTESTED` | synchronise Google |
| Libération des créneaux bloqués | `IMPLEMENTED_UNTESTED` | travail planifié quotidien |

## 6. Communication

| Fonctionnalité | État | Détail |
|---|---|---|
| File des messages sortants | `IMPLEMENTED_UNTESTED` | idempotence, reprise, « SMS non envoyé — Réessayer » |
| Envoi SMS | `BLOCKED_EXTERNAL_CONFIG` | adaptateur écrit contre la documentation ; **aucun SMS n'est jamais parti** |
| Accusés de réception | `BLOCKED_EXTERNAL_CONFIG` | webhook signé, non exercé |
| SMS entrant | `BLOCKED_EXTERNAL_CONFIG` | organisation résolue par le numéro appelé |
| Notifications dans l'application | `IMPLEMENTED_UNTESTED` | déduplication, pastille, écran dédié |
| Notifications poussées sur le téléphone | `MISSING` | rien |
| WhatsApp, e-mail, formulaire web | `MISSING` | énumération et tables prêtes, aucun adaptateur |
| E-mail transactionnel (invitations) | `MISSING` | le lien d'invitation est affiché et transmis à la main |

## 7. Plateforme

| Fonctionnalité | État | Détail |
|---|---|---|
| Espace d'administration | `IMPLEMENTED_UNTESTED` | garde séparée, aucun accès aux audios (ADR-033) |
| Métiers modifiables sans code | `IMPLEMENTED_UNTESTED` | création et publication depuis l'écran |
| Offres et abonnements | `PARTIAL` | tables, écran, édition ; **aucun paiement**, aucun prix fixé (volontaire, section 38) |
| Consommation | `IMPLEMENTED_UNTESTED` | minutes, SMS, comptés avec déduplication |
| Santé et erreurs fournisseurs | `IMPLEMENTED_UNTESTED` | table alimentée par les échecs SMS ; **pas encore par les échecs Calendar ni IA** |
| Journal d'audit | `IMPLEMENTED_UNTESTED` | chaque écriture de la plateforme, plus les suppressions d'appels |

---

## Problèmes trouvés pendant cet audit

### Corrigés en 0.14.0

**La liste de l'équipe ne se chargeait jamais.** `organization_members.user_id` et
`profiles.id` référencent tous deux `auth.users`, mais aucune clé étrangère ne relie les
deux tables. PostgREST ne pouvait donc pas déduire la relation, et la requête échouait avec
« could not find a relationship ». L'écran affichait un message d'erreur honnête mais
inexploitable. Migration 0029 : les profils manquants sont créés, puis la clé étrangère est
posée.

**La liste des appels chargeait tout.** Cinquante lignes au maximum, sans total, sans
pagination, et le filtre « sans suite » se calculait dans le navigateur sur cette tranche —
donc faux dès le cinquante-et-unième appel.

**Aucun moyen de supprimer un appel.** Désormais une corbeille, réservée aux responsables,
journalisée, qui n'emporte ni rendez-vous, ni contact, ni demande.

**Un appel supprimé continuait de compter.** Les compteurs de l'accueil ignorent maintenant
la corbeille : un chiffre qui ne correspond à aucune liste est pire que pas de chiffre.

### Non corrigés, et pourquoi

| Problème | Priorité | Pourquoi il reste |
|---|---|---|
| Sophie ne lit pas `business_knowledge` pendant l'appel | **haute** | demande un nouvel outil métier et un test en appel réel ; l'écran existe depuis 0.13.0, mais ce qu'on y écrit n'atteint pas encore Sophie |
| Aucun écran pour déclarer un numéro de téléphone | **haute** | dépend du modèle d'acquisition, qui dépend d'un compte opérateur |
| Pas d'écran de tâches | moyenne | les tâches existent et sont comptées ; il manque la liste et la clôture |
| Pas d'écran de configuration de Sophie après l'inscription | moyenne | voix, style et message d'accueil se changent aujourd'hui chez le fournisseur |
| Transcriptions et SMS sans politique de purge | **haute, juridique** | contiennent nom, adresse, problème ; à trancher avec la liste juridique |
| Échecs Calendar et IA non consignés dans `provider_errors` | basse | deux appels de fonction à ajouter |
| Notifications poussées | basse | demande un service de notification et un consentement |

---

## Ce qu'il faudrait tester, et qu'on ne peut pas tester ici

| Test | Ce qu'il exige |
|---|---|
| Un vrai appel sur un vrai numéro, de bout en bout | un numéro |
| Un résumé produit par un vrai modèle | une clé d'IA |
| Un SMS reçu sur un vrai téléphone | un compte opérateur |
| L'agenda d'un client qui n'est pas nous | la validation de l'application Google |
| Pagination sur un gros volume | quelques milliers d'appels ; la requête est écrite pour tenir, ce n'est pas prouvé |
| Isolation entre deux organisations sur les nouveaux écrans | `SUPABASE_TEST_*` et la vraie base |

Les tests automatisés du dépôt — 307 au dernier compte — vérifient la logique, les
garanties des migrations et la cohérence entre le SQL et le TypeScript. Ils ne remplacent
aucune des lignes ci-dessus.
