# Audit fonctionnel de Sophie IA

**Date** 2026-11-02 · **Version auditée** 0.15.0 · **Méthode** lecture du code, des
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
| Déclaration d'un numéro | `IMPLEMENTED_UNTESTED` | 0.15.0 : `/app/sophie/ligne`, trois modes de raccordement, instructions de renvoi, dernière erreur ; **n'invente ni numéro ni activation** sans fournisseur configuré |
| Connaissances utilisées pendant l'appel | `IMPLEMENTED_UNTESTED` | l'outil lit `business_knowledge` et passe avant les autres sources ; **usage réel par Sophie non vérifié**, le fournisseur vocal n'est pas appelable d'ici |
| Transfert vers un humain | `IMPLEMENTED_UNTESTED` | outil déclaré, jamais déclenché en appel réel |
| Enregistrement audio conservé | `COMPLETE_TESTED` | rapatrié, servi par adresse signée, écouté le 2026-10-23 |
| Transcription | `COMPLETE_TESTED` | tour par tour, horodatée ; **qualité française insuffisante**, voir § 10 |
| Résumé et extraction | `BLOCKED_EXTERNAL_CONFIG` | produits par nous (ADR-031) ; sans `AI_API_KEY`, un résumé **simulé** s'affiche en le disant |

## 4. CRM

| Fonctionnalité | État | Détail |
|---|---|---|
| Contacts, déduplication par téléphone | `COMPLETE_TESTED` | provenance du numéro affichée (réseau / dicté) |
| Prospects et pipeline | `COMPLETE_TESTED` | six états, écrans liste et fiche |
| Tâches | `IMPLEMENTED_UNTESTED` | 0.15.0 : `/app/taches`, quatre vues, création et clôture d'un pouce ; échéance posée en fin de journée locale, pas à minuit UTC |
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
| Notifications poussées sur le téléphone | `MISSING` | demande un service de notification et un consentement |
| WhatsApp, e-mail, formulaire web | `MISSING` | énumération et tables prêtes, aucun adaptateur |
| E-mail transactionnel (invitations) | `MISSING` | le lien d'invitation est affiché et transmis à la main |

## 7. Plateforme

| Fonctionnalité | État | Détail |
|---|---|---|
| Espace d'administration | `IMPLEMENTED_UNTESTED` | garde séparée, aucun accès aux audios (ADR-033) |
| Métiers modifiables sans code | `IMPLEMENTED_UNTESTED` | création et publication depuis l'écran |
| Offres et abonnements | `PARTIAL` | tables, écran, édition ; **aucun paiement**, aucun prix fixé (volontaire, section 38) |
| Consommation | `IMPLEMENTED_UNTESTED` | minutes, SMS, comptés avec déduplication |
| Santé et erreurs fournisseurs | `IMPLEMENTED_UNTESTED` | 0.15.0 : six chemins d'échec consignés (SMS, Calendar poussé, Calendar synchronisé, IA, événement vocal, audio perdu) |
| Conservation et purge | `IMPLEMENTED_UNTESTED` | 0.15.0 : trois durées par entreprise, six purges indépendantes, journal `retention_runs` visible du seul super administrateur ; **durées à valider juridiquement** |
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

### Corrigés en 0.15.0

Les sept problèmes listés comme « non corrigés » en 0.14.0 ont été repris par ordre de
criticité. Six sont traités, un reste hors de portée d'ici.

**Sophie ne lisait pas `business_knowledge` pendant l'appel.** L'outil existe désormais
(`src/lib/sophie/tools.ts`) et les connaissances saisies par le professionnel passent avant
toute autre source. **Vérification en appel réel : en attente.** Le fournisseur vocal ne
peut pas être appelé depuis cet environnement ; ce qui est prouvé, c'est que l'outil lit la
table et respecte l'organisation, pas que Sophie s'en sert au téléphone. Cette ligne reste
ouverte jusqu'au premier appel réel.

**Aucun écran pour déclarer un numéro.** `/app/sophie/ligne` existe : numéro, fournisseur,
état, mode de raccordement, instructions de renvoi, dernière erreur. Trois modes sont prévus
dans le modèle (`line_connection_mode`) : renvoi depuis la ligne existante, numéro dédié,
portabilité. **L'écran ne fabrique rien** : sans fournisseur configuré, il le dit et
n'invente ni numéro ni activation. La date de premier appel reçu (`verified_at`) est posée
par le webhook, pas par le formulaire : c'est la seule preuve qu'un renvoi fonctionne.

**Pas d'écran de tâches.** `/app/taches`, quatre vues (en retard, aujourd'hui, à faire,
terminées), création à la main, clôture d'un pouce. L'accueil annonçait « 3 tâches en
retard » et renvoyait vers un filtre de prospects qui ignorait ce mot : le compte était
juste, le lien ne menait nulle part. Il mène maintenant à la bonne liste.

**Transcriptions, résumés et messages sans politique de purge.** Migration 0030 : trois
durées réglables par entreprise (30 jours à 5 ans), trois fonctions de purge qui lisent la
durée *de chaque* organisation, un journal d'exécution (`retention_runs`) lisible du seul
super administrateur, et six purges indépendantes dans la tâche planifiée — une purge
bloquée retarde les autres d'une journée au lieu de les empêcher. Les fichiers partent avant
les lignes qui les désignent : l'ordre inverse laisserait des objets que plus rien ne
référence, donc que plus rien ne supprimerait. **Les durées restent à faire valider
juridiquement** ; l'écran le dit au professionnel au lieu de laisser croire que le défaut
d'un an a été validé par quelqu'un.

**Échecs Calendar et IA non consignés.** Six chemins d'échec écrivent maintenant dans
`provider_errors` : SMS refusé, rendez-vous non poussé, synchronisation ratée, résumé
impossible, événement vocal rejeté, audio perdu. Un `console.error` ne se mesure pas et les
journaux de l'hébergeur expirent ; une panne de trois jours y ressemblait à trois accidents.

**Pas d'écran de configuration de Sophie après l'inscription.** Partiellement traité : la
page `/app/sophie` dit désormais l'état réel de la ligne et renvoie vers la ligne, les
connaissances et l'enregistrement. La voix et le style se règlent toujours chez le
fournisseur vocal, et la page le dit au lieu de promettre un écran qui n'existe pas.

### Non corrigés, et pourquoi

| Problème | Priorité | Pourquoi il reste |
|---|---|---|
| Les connaissances ne sont pas vérifiées en appel réel | **haute** | demande un appel sur un vrai numéro ; l'outil est écrit et testé, son usage par Sophie ne l'est pas |
| Voix et style de Sophie non réglables depuis l'application | moyenne | se règlent chez le fournisseur vocal ; demande de décider si l'application devient la source de vérité |
| Notifications poussées | basse | demande un service de notification et un consentement |
| Durées de conservation non validées juridiquement | **haute, juridique** | voir `LEGAL_COMPLIANCE.md` point L5 ; le réglage existe, la valeur correcte dépend du pays et du métier |

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
| Une purge qui supprime réellement des lignes arrivées à échéance | une base avec des appels vieux de plus d'un an, ou des dates reculées à la main |
| Un renvoi d'appel GSM qui aboutit sur Sophie | un numéro et un téléphone |

Les tests automatisés du dépôt — 338 au dernier compte, plus 17 ignorés faute de
`SUPABASE_TEST_*` — vérifient la logique, les garanties des migrations et la cohérence entre
le SQL et le TypeScript. Ils ne remplacent aucune des lignes ci-dessus.
