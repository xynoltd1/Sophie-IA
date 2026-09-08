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
