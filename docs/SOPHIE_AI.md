# Sophie — la partie IA

## Ce qu'elle est

Une secrétaire, pas un chatbot. Sa philosophie tient en une ligne :

**Répondre → Comprendre → Qualifier → Agir avec les outils autorisés → Résumer →
Centraliser → Alerter si nécessaire.**

Elle ne confond jamais raisonnement conversationnel et vérité métier.

## Architecture

```
ProfessionTemplate  →  OrganizationConfiguration  →  SophieRuntime
   (défauts métier)      (surcharges entreprise)      (ce qui tourne pendant l'appel)
```

- `ProfessionTemplate` : services suggérés, questions de qualification, catégories
  d'urgence, durées indicatives, vocabulaire, informations importantes. Modifiable depuis
  la console plateforme, sans toucher au code.
- `OrganizationConfiguration` : ce que l'entreprise a réellement retenu et personnalisé.
- `SophieRuntime` : la configuration résolue au moment de l'appel.

`SophieEngine` orchestre. **Le moteur vocal n'accède jamais directement à PostgreSQL** :
il passe par des outils serveur qui valident permissions, données et règles métier.

## Outils exposés

```
get_business_information()      find_contact_by_phone()      create_contact()
get_service_information()       check_service_area()         check_availability()
hold_time_slot()                create_pending_appointment()  reschedule_appointment()
cancel_appointment()            create_lead()                create_task()
mark_urgent()                   request_human_transfer()     send_confirmation_message()
```

Chaque outil : valide l'organisation, valide le rôle, valide les données, applique les
règles, écrit une `Activity`, retourne un résultat explicite en cas d'échec.

## Intentions reconnues

Prise de rendez-vous · modification · annulation · demande de devis · urgence · question
sur les services · question tarifaire · réclamation · suivi · message · demande de rappel ·
démarchage · demande inconnue.

« Demande inconnue » est une réponse valide et attendue, pas un échec.

## Connaissances

Sophie n'utilise que des informations contrôlées : profil entreprise, services, tarifs
configurés, FAQ, zones d'intervention, instructions, règles, et la table
`BusinessKnowledge` alimentée par le professionnel.

**Elle n'invente jamais un tarif, une disponibilité ou un service.** Si l'information
n'existe pas, elle dit qu'elle transmettra la demande.

**Aucun apprentissage autonome à partir des appels.** Le professionnel corrige et complète
Sophie manuellement, depuis l'écran *Sophie → Connaissances*. Une IA qui se met à jour
seule à partir de conversations téléphoniques finirait par affirmer des tarifs approximatifs
à des clients réels.

## Post-appel

Trois productions distinctes, dans cet ordre de priorité :

1. **l'audio original** — indépendant de tout le reste, jamais supprimé par un échec de
   traitement ;
2. **la transcription** — conversationnelle, avec horodatages quand disponibles, structurée
   pour permettre plus tard de cliquer un passage et d'y positionner le lecteur ;
3. **le résumé et l'extraction structurée** — `intent`, `service`, `urgency`,
   `customer_name`, `address`, `requested_date`, `requested_time`, `problem_description`,
   `appointment_requested`, `callback_requested`.

**Un champ inconnu reste nul.** On n'hallucine jamais pour remplir une case. Un niveau de
confiance accompagne les extractions sensibles.

## Transparence et limites

Sophie reste transparente sur sa nature d'assistante virtuelle lorsque la configuration et
les obligations applicables l'exigent (voir `docs/SECURITY.md` et la note juridique de
`docs/PRODUCT_SPEC.md`).

Elle n'improvise jamais de conseil technique dangereux — une fuite de gaz, un tableau
électrique qui chauffe : elle marque l'urgence, applique les règles de la profession et
transfère.

## Mode test

Le professionnel doit pouvoir essayer Sophie avant de l'activer. Les appels de test portent
`is_test = true` et **n'entrent ni dans les prospects, ni dans les statistiques, ni dans la
consommation facturée**.

## L'accueil téléphonique (0.20.0)

### La forme

> « Martin Plomberie, bonjour. Je suis Sophie, votre assistante virtuelle.
> Comment puis-je vous aider ? »

Le nom de l'entreprise **d'abord**. C'est ainsi que décroche une vraie secrétaire, et
cela répond immédiatement à la question de l'appelant : ai-je composé le bon numéro ?
Une phrase qui commence par « Bonjour, ici Sophie » laisse cette question ouverte trois
secondes.

### Le chemin complet d'un appel entrant

1. Le téléphone sonne. Le numéro appelé n'a **pas** d'assistant fixe chez le fournisseur.
2. Le fournisseur envoie `assistant-request` à `/api/voice/assistant`.
3. La route vérifie la signature, puis appelle `accueilPourNumero(numéro)`.
4. `sophie_runtime_for_number` rend, **en un aller-retour**, l'organisation et toute sa
   configuration d'accueil.
5. `composerAccueil` remplace les variables et garantit la mention d'IA.
6. `buildAnnouncement` ajoute l'annonce d'enregistrement, si et seulement si
   `recording_allowed()` dit que l'enregistrement a lieu.
7. La route répond `{ assistantId, assistantOverrides }`.
8. Le fournisseur prononce la phrase.

Budget total : **7,5 secondes**, non configurable. C'est la raison de l'étape 4 en une
seule requête.

### Les modules

| Fichier | Rôle | Pur ? |
|---|---|---|
| `lib/sophie/greeting.ts` | compose la phrase, garantit la mention d'IA | oui |
| `lib/sophie/assistant-response.ts` | la réponse au fournisseur, les refus | oui |
| `lib/sophie/runtime.ts` | résout le numéro, assemble | non (serveur) |
| `lib/sophie/announcement.ts` | l'annonce légale | non (serveur) |
| `app/api/voice/assistant/route.ts` | signature, aiguillage | non |

Les deux premiers sont purs **délibérément** : l'aperçu de l'écran de réglages les
appelle aussi. Un aperçu qui recomposerait la phrase de son côté finirait par montrer
autre chose que ce qui est prononcé.

### Les variables d'une formule

`{entreprise}` `{assistante}` `{metier}` `{moment}`

`{moment}` rend « bonjour » ou « bonsoir » selon l'heure **dans le fuseau de
l'entreprise**. Le serveur tourne en UTC : sans le fuseau, un appel reçu à 20 h à
Bruxelles recevrait un « bonjour » calculé sur 19 h UTC.

Une variable inconnue est laissée telle quelle (`{ancienNom}`) plutôt que vidée : dans
l'aperçu, cela dit immédiatement ce qui ne va pas, alors qu'un trou silencieux se
découvre au téléphone.

### Les quatre refus

| Motif | Quand |
|---|---|
| `NUMERO_INCONNU` | le numéro appelé n'est dans aucune organisation, ou est inactif |
| `ORGANISATION_SUPPRIMEE` | l'organisation porte un `deleted_at` |
| `SOPHIE_INACTIVE` | Sophie est éteinte ou en mode `OFF` |
| `SANS_ASSISTANT` | aucun assistant déclaré chez le fournisseur |

**Aucune de ces quatre phrases ne nomme d'entreprise.** À ce stade on ne sait pas
laquelle, et en nommer une au hasard serait exactement la fuite entre clients que toute
l'architecture empêche.

### Ce qui n'est pas réglable, et pourquoi

**La mention d'IA.** Article 50 du règlement (UE) 2024/1689. Si la formule saisie ne la
contient pas, `composerAccueil` ajoute « Je suis une assistante virtuelle. » La garantie
est dans le composeur et non dans le formulaire : c'est le seul point par lequel passent
toutes les phrases, y compris celles enregistrées avant la règle.

**L'existence de l'annonce d'enregistrement.** Sa position se règle, sa présence non.
Elle vient de `recording_allowed()`, pas d'un texte saisi, et disparaît d'elle-même
quand l'enregistrement s'arrête.
