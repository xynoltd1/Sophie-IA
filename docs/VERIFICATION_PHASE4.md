# Vérifications à faire — version 0.7.0

> **Rien de ce qui suit n'a été vérifié avec un vrai appel.** Tout a été écrit
> et passe les contrôles automatiques, ce qui ne prouve rien : trois bugs cette
> semaine (ADR-024, ADR-025, ADR-027) avaient tous un build vert et n'ont été
> trouvés que par un contact avec le réel.
>
> Ce document n'est pas une liste de fonctionnalités à cocher. C'est une suite
> d'appels à passer, avec **ce que vous devez entendre** et **ce que vous devez
> voir ensuite dans l'application**. Si l'un des deux manque, la fonctionnalité
> n'est pas terminée, quoi qu'en dise le reste de la documentation.

---

## Avant de commencer

| | |
|---|---|
| Migrations à appliquer | `0019` puis `0020`, si ce n'est pas déjà fait |
| Variable à ajouter sur Vercel | `VOICE_API_KEY` — sans elle, l'audio restera bloqué |
| Déploiement | poussé sur GitHub, Vercel affiche **Ready** |
| Assistant Vapi | les outils doivent être déclarés (voir § Déclarer les outils) |

**Les vérifications 2 à 8 se font depuis le navigateur**, avec le bouton *Talk*,
sans numéro de téléphone et sans frais. Il suffit que l'adresse des événements
déclarée dans l'assistant porte `?org=<identifiant de votre entreprise>`.

Ces appels sont **toujours** marqués comme essais et n'entrent dans aucune
statistique. C'est automatique et non modifiable : un appel sans numéro appelé
ne peut venir que du bouton d'essai.

**Un vrai numéro reste nécessaire** pour une seule chose : vérifier que la
téléphonie elle-même fonctionne. C'est la vérification 9, et elle peut attendre.

Le numéro d'essai ne doit **jamais** être publié. La frontière entre test et
production est un numéro différent, pas une case à cocher : le vrai risque
n'est pas votre voix, c'est un client réel qui appellerait par erreur et se
retrouverait enregistré sans information ni base légale.

---

## Déclarer les outils chez Vapi

Sophie connaît maintenant huit outils. Tant qu'ils ne sont pas déclarés dans
l'assistant, elle ne peut pas s'en servir — elle improvisera, ce qui est
exactement ce que le produit interdit.

Pour chacun, dans Vapi → **Tools** → Create Tool → Function :

| Nom | Ce qu'il fait |
|---|---|
| `check_availability` | déjà créé |
| `get_business_information` | services, zone, horaires |
| `identify_caller` | reconnaît un client à son numéro |
| `save_caller_details` | enregistre nom, adresse, e-mail |
| `create_lead` | enregistre la demande |
| `create_task` | crée un rappel pour vous |
| `create_pending_appointment` | pose un rendez-vous à valider |
| `request_human_transfer` | demande à vous passer l'appel |

Tous utilisent la **même** adresse serveur et le **même** en-tête
`x-vapi-secret` que `check_availability`. Les paramètres exacts de chacun sont
dans `src/lib/sophie/tools.ts` et `src/lib/sophie/tools-crm.ts`, dans le champ
`parameters` de chaque outil — recopiez-les tels quels.

---

## Vérification 1 — Sophie sait quel jour on est

**Appel :** depuis le navigateur (*Talk*) ou le téléphone.
**Dites :** « Je voudrais un rendez-vous lundi prochain. »

**Vous devez entendre** des heures proposées, et non « cette date est déjà
passée ».

**Vous devez vérifier** que ces heures sont exactement celles de votre page
Agenda pour ce lundi-là.

*Si elle dit encore qu'une date est passée* : les deux lignes de date manquent
au début du System prompt de l'assistant.

---

## Vérification 2 — L'appel apparaît dans l'application

**Appel :** depuis votre téléphone, vers le numéro d'essai.
**Dites :** n'importe quoi, puis raccrochez.

**Vous devez voir**, dans **Appels** : une ligne avec votre numéro, l'heure, la
durée, le statut « Terminé », et la mention « essai ».

*Si rien n'apparaît* : l'adresse des événements n'est pas déclarée chez Vapi.
Elle doit pointer sur `https://zelicall.com/api/voice/events`, avec le même
en-tête `x-vapi-secret`. Vérifiez aussi que la ligne du numéro existe bien dans
`phone_numbers`.

---

## Vérification 3 — Sophie vous reconnaît au deuxième appel

**Premier appel :** « Bonjour, je m'appelle Marie Dupont, j'habite rue de la
Gare à Tongeren. »

**Vous devez entendre** qu'elle prend note, sans insister.

**Vous devez voir**, dans **Prospects** ou sur la fiche d'appel : un contact
nommé Marie Dupont, avec l'adresse.

**Deuxième appel, depuis le même téléphone :** « Bonjour. »

**Vous devez entendre** qu'elle vous appelle par votre nom et ne redemande pas
vos coordonnées.

*C'est le test le plus parlant du produit.* Un client qui se fait redemander son
nom au troisième appel sait qu'il parle à une machine mal faite.

---

## Vérification 4 — La demande devient un prospect

**Appel :** « J'ai une fuite sous l'évier, c'est urgent. »

**Vous devez entendre** qu'elle a compris l'urgence.

**Vous devez voir** dans **Prospects** une demande intitulée à peu près « Fuite
sous l'évier », en priorité urgente, rattachée à votre contact.

**Vérifiez aussi** que la description reprend vos mots et n'invente rien —
pas d'adresse que vous n'avez pas donnée, pas de marque de chaudière imaginaire.

---

## Vérification 5 — Le rappel devient une tâche

**Appel :** « Demandez-lui de me rappeler demain matin. »

**Vous devez voir** dans l'application une tâche « Rappeler… », échéance au
lendemain.

---

## Vérification 6 — Le rendez-vous est provisoire, jamais confirmé

**Appel :** demandez un rendez-vous, laissez-la proposer des heures, acceptez-en
une.

**Vous devez entendre** qu'elle dit que **le professionnel confirmera**. Si elle
dit « c'est noté, c'est confirmé », c'est une régression grave : Sophie ne
confirme jamais à votre place (section 22).

**Vous devez voir** dans **Agenda** un rendez-vous marqué **À valider**.

**Vérifiez ensuite** que ce créneau a disparu des disponibilités : rappelez et
demandez le même jour, l'heure prise ne doit plus être proposée.

---

## Vérification 7 — Deux appels ne peuvent pas prendre la même heure

**Appel :** prenez un rendez-vous à une heure donnée. Sans raccrocher,
demandez à quelqu'un d'appeler et de demander exactement la même heure.

**Vous devez entendre**, au deuxième appel, qu'elle propose autre chose.

C'est la base de données qui l'empêche, pas l'intelligence artificielle. Si les
deux rendez-vous passent, la contrainte d'exclusion de la migration 0015 n'est
pas active, et c'est à corriger avant tout client réel.

---

## Vérification 8 — Le transfert dit la vérité

**Appel :** « Je veux parler à quelqu'un. »

Si aucun numéro de transfert n'est configuré, **vous devez entendre** qu'elle
ne peut pas transférer, et qu'elle propose de prendre vos coordonnées. Elle ne
doit jamais faire patienter pour un transfert qui n'aura pas lieu.

---

## Ce qui ne peut pas encore être vérifié

**L'audio.** Le lecteur existe sur la fiche d'appel, mais la copie de
l'enregistrement vers votre espace Supabase n'est pas écrite. La fiche dira
« enregistrement en cours de récupération », ce qui est la vérité.

**La transcription et le résumé.** Même chose : la fiche annonce leur absence
plutôt que d'afficher un bloc vide.

**La configuration automatique de l'assistant** depuis vos écrans (nom, voix,
annonce). Aujourd'hui l'assistant est réglé à la main dans Vapi.

Ces trois points demandent `VOICE_API_KEY` et constituent la suite du travail.
