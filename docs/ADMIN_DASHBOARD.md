# Console d'administration

**Version 0.17.0** · Écrit le 2026-11-04

---

## Pourquoi une refonte

L'ancienne console était une rangée de cinq onglets horizontaux au-dessus de pages
techniques. Deux défauts, dont un seul se voyait.

**Celui qui se voyait** : au sixième onglet il aurait fallu faire défiler, au neuvième la
barre serait devenue illisible. Une console grandit par rubriques ; une colonne grandit
vers le bas, ce qu'un écran accepte, une rangée grandit vers la droite, ce qu'il refuse.

**Celui qui ne se voyait pas** : l'écran de santé affichait « Testé en conditions réelles »
juste au-dessus de « Variables manquantes : VOICE_PROVIDER ». Les deux affirmations
étaient exactes. L'une venait d'un registre écrit à la main dans le code, l'autre de
l'environnement lu à l'affichage. Le défaut n'était pas l'affichage : c'était qu'un seul
mot portait trois questions.

## La structure

Panneau vertical à gauche, fixe sur ordinateur, rétractable sur téléphone, en trois
groupes :

| Groupe | Rubriques |
|---|---|
| Pilotage | Vue d'ensemble · Statistiques · SEO et acquisition |
| Clients | Entreprises · Utilisateurs · Métiers · Offres et abonnements |
| Exploitation | Appels et consommation · Santé du système · Mon compte |

En bas du panneau : le compte, avec initiales, nom, adresse, et un menu — Mon compte,
Retour à l'application, Se déconnecter.

**La déconnexion est un formulaire vers une action serveur.** Elle termine la session
Supabase et efface les cookies côté serveur. Un bouton qui viderait l'état du navigateur
laisserait la session valide : la personne se croirait déconnectée sans l'être, ce qui est
pire que pas de bouton sur un poste partagé.

## La couleur

Le panneau est vert profond ; l'application cliente est claire. Ce n'est pas une
décoration : quelqu'un qui a sous les yeux les données de **toutes** les entreprises doit
savoir d'un coup d'œil qu'il n'est plus chez lui. Se tromper d'espace est une faute, et la
couleur l'empêche.

Jetons : `--color-console`, `--color-console-raised`, `--color-console-line`,
`--color-console-ink`, `--color-console-ink-soft`, `--color-console-accent`. L'accent est
plus clair que le vert de l'application : sur fond sombre, celui-ci devient illisible.

## Les chiffres

Tout est calculé en base (migration 0033). Compter côté application obligerait à rapatrier
des milliers de lignes pour en faire une somme — et la somme serait fausse dès que la
pagination s'en mêlerait.

Trois périodes : 7, 30, 90 jours, dans l'adresse, donc partageables.

**Les appels d'essai sont exclus partout.** Ils gonfleraient chaque chiffre sans qu'aucun
client n'ait appelé.

### « Non disponible » est une valeur

Le chiffre d'affaires, le coût fournisseurs, le coût par minute, la marge, le revenu
récurrent, le taux de désabonnement et la rétention affichent **Non disponible**, avec la
raison.

Aucun paiement n'est branché, et le produit ne connaît ni le tarif du fournisseur de voix,
ni celui du modèle, ni celui de l'opérateur. Les estimer donnerait une marge fausse — et
une marge fausse oriente une décision de prix. C'est le pire endroit où mettre un chiffre
inventé. Un test l'interdit.

### Les graphiques

Tracés à la main en SVG. Trois courbes et deux histogrammes ne valent pas cent kilo-octets
de JavaScript, et toute bibliothèque impose sa palette qu'il faut ensuite combattre.
Chaque graphique porte un tableau équivalent, invisible à l'œil et lu par les lecteurs
d'écran.

### Export

`/admin/statistiques/export?periode=30` renvoie un CSV. Point-virgule et BOM : sans les
deux, Excel en français ouvre le fichier en une colonne et casse les accents.

## La santé, refaite

Quatre questions séparées :

1. **Le code sait-il le faire ?** — registre `src/lib/providers/status.ts`.
2. **La configuration le permet-elle aujourd'hui ?** — variables d'environnement.
3. **Quand un échange réel a-t-il réussi ?** — table `integration_checks`.
4. **Qu'est-ce qui a échoué récemment ?** — table `provider_errors`.

Quatre états : `OPERATIONNEL`, `EN_PANNE`, `NON_CONFIGURE`, `JAMAIS_EXERCE`.

**Le présent l'emporte sur le passé.** Une intégration mal configurée est hors service,
quel que soit son historique. Un test réussi le 23 octobre ne prouve rien sur aujourd'hui ;
il reste affiché comme contexte, jamais comme preuve.

`integration_checks` se remplit toute seule : chaque échange réel réussi écrit `OK`
(rendez-vous poussé dans Google, synchronisation, résumé produit par un vrai modèle, audio
rapatrié, événement vocal traité, SMS parti), chaque panne consignée écrit `FAIL`. Les
opérations simulées n'écrivent rien : un résumé simulé ne prouve pas qu'un modèle répond.

## Sécurité

- `requirePlatformAdmin()` est appelé dans la mise en page **et** dans chaque page. Une
  mise en page protégée ne protège pas une page atteinte autrement, et une vérification en
  trop ne coûte qu'une requête. Un test parcourt `src/app/admin` et échoue si une page ou
  une route l'oublie.
- Le droit d'administration ne se donne pas depuis la console. Un espace capable de se
  distribuer ses propres droits n'a besoin que d'une faille.
- Les adresses e-mail des utilisateurs sont tronquées. Exploiter la plateforme ne demande
  pas de lire le carnet d'adresses de ses clients, et une liste d'e-mails professionnels
  est exactement ce qu'on vole dans une base.
- Aucun accès aux enregistrements audio (ADR-033).
- Le changement de mot de passe redemande l'ancien et le **vérifie**. Supabase ne l'exige
  pas — une session valide suffit à son API. Mais une session valide, c'est un écran resté
  ouvert dans un bureau.

## SEO et acquisition — ce qui se règle depuis l'écran

Depuis la 0.19.0, `/admin/seo` ne fait plus que constater :

- **Connecter Search Console** — OAuth réel, lecture seule. Puis choix de la propriété à
  suivre, et affichage des clics, impressions, positions, requêtes et pages.
- **Référencement page par page** — titre, description, priorité, et trois interrupteurs
  par page publique. Le chemin n'est pas saisissable (ADR-044).
- **Image de partage** — téléversement d'un PNG, JPEG ou WebP sous 2 Mo, applicable à tout
  le site ou à une seule page.

Ce que l'écran continue de refuser de faire : afficher une position sans connexion,
inventer un créneau d'indexation, ou prétendre pouvoir vérifier une propriété de domaine à
la place de son propriétaire.

**Les trois actions sont journalisées** (`search_console.connect`,
`search_console.property`, `search_console.disconnect`, `seo_page.update`,
`seo_image.upload`) dans `audit_logs`, table qu'aucun client ne peut lire.

## Ce qui n'est pas fait

- **Changer d'adresse e-mail.** Il faudrait vérifier la nouvelle avant d'abandonner
  l'ancienne, sinon une faute de frappe ferme le compte définitivement. Mieux vaut
  l'absence qu'une version qui enferme dehors.
- **Lister les sessions ouvertes.** Supabase ne le permet pas depuis l'application.
- **Avatar.** Demande un stockage d'images et une modération ; des initiales suffisent.
