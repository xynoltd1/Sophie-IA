# Sophie IA — le projet

## En une phrase

Pendant que l'artisan travaille, Sophie répond à ses clients, comprend leurs demandes,
qualifie les prospects, consulte les disponibilités, propose des rendez-vous, prend des
messages et centralise tout dans une seule application mobile.

## Pour qui

Artisans et professionnels de terrain : plombiers, électriciens, serruriers,
chauffagistes, climaticiens, garagistes, menuisiers, peintres, jardiniers, techniciens,
entreprises de nettoyage.

**Le produit n'est jamais codé pour un métier en particulier.** Le professionnel choisit
son métier à l'inscription ; un `ProfessionTemplate` fournit des valeurs par défaut
(services, questions, urgences, durées, vocabulaire) que l'entreprise surcharge ensuite.
Ajouter le métier « vitrier » doit se faire depuis la console d'administration, sans
toucher au code.

## L'utilisateur type

Un homme ou une femme debout sur un chantier, une main occupée, le téléphone dans
l'autre, au soleil. Il ouvre l'application entre deux interventions. La seule question à
laquelle l'écran d'accueil doit répondre est : **« qu'est-ce qui demande mon attention
maintenant ? »**

Conséquences sur toutes les décisions produit :
- mobile d'abord, toujours ;
- peu d'étapes, gros boutons, contraste élevé ;
- langage simple, pas de jargon CRM ;
- la couleur signale un statut, jamais une décoration.

## Le critère de réussite

Ce scénario doit fonctionner réellement, de bout en bout (section 63 du cahier des
charges) :

L'artisan configure son entreprise et son métier → il connecte son agenda → il active
Sophie → un client appelle → Sophie répond, comprend, identifie le contact, vérifie les
**vraies** disponibilités, propose un créneau, le bloque → l'audio est conservé de façon
sécurisée → la transcription et le résumé apparaissent → le prospect apparaît → le
rendez-vous apparaît « à valider » → l'artisan est notifié, écoute l'appel depuis son
téléphone, accepte → le back-end revérifie la disponibilité, met à jour Google Calendar,
confirme → le client reçoit un SMS → tout est dans l'historique.

Tant que ce parcours n'est pas réel, le produit n'existe pas.

## Les trois règles qui priment sur tout

1. **Une fonctionnalité n'est pas terminée parce que son interface existe.** Elle est
   terminée quand le parcours complet fonctionne : interface → API → autorisation →
   logique métier → base → intégration → retour utilisateur → erreurs → historique →
   tests.
2. **Ne jamais simuler silencieusement.** Si une clé manque, on implémente l'adaptateur
   réel et on documente la variable. Un mode simulé existe, mais il est marqué comme tel
   à l'écran. On ne dit jamais qu'un SMS est parti s'il n'est pas parti.
3. **Sophie ne dit jamais une vérité métier qu'elle a inventée.** Disponibilité, tarif,
   service, zone, identité, rendez-vous : tout vient des données, via des outils
   contrôlés côté serveur.

## Ce qui n'est pas dans le MVP

Comptabilité, paie, stock, GPS avancé, marketplace, facturation complète, devis
complexes, applications natives séparées iOS et Android, autonomie de l'IA sans
garde-fous. L'architecture peut les préparer ; le MVP ne s'y perd pas.
