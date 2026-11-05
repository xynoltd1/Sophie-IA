# Référencement

**Version 0.17.0** · Écrit le 2026-11-04

---

## L'état avant

Le site n'avait **aucune page publique**. `/` redirigeait vers la connexion, et les
seules adresses atteignables sans compte étaient `/login` et `/signup`. Il n'y avait ni
`robots.txt`, ni plan du site, ni adresse canonique, ni donnée structurée.

Ce n'était pas un défaut de configuration : il n'y avait rien à référencer. Tout travail
de référencement aurait porté sur le vide.

## Ce qui existe maintenant

### Une page publique

`/` est une vraie page d'accueil : ce que fait Sophie, comment un appel se déroule, ce
qu'elle refuse de faire, et les questions fréquentes.

**La ligne éditoriale est une contrainte technique autant qu'éthique.** Aucun chiffre
inventé, aucun témoignage, aucun logo de client : le produit n'a pas encore de client, et
Google sanctionne le contenu trompeur autant que les lecteurs le détectent. Ce qui tient
lieu d'argument, ce sont les limites — la section « ce que Sophie ne fera jamais ».

### Indexation

| Élément | Où | Comportement |
|---|---|---|
| `robots.txt` | `src/app/robots.ts` | autorise le site, interdit sept espaces privés, déclare le plan du site |
| `sitemap.xml` | `src/app/sitemap.ts` | liste explicite, jamais un parcours de dossiers |
| Canonique | `src/app/(public)/page.tsx` | `alternates.canonical` |
| Adresse de base | `src/app/layout.tsx` | `metadataBase`, pour que toutes les adresses relatives soient résolues |
| 404 | `src/app/not-found.tsx` | vrai code 404, en `noindex` |

**Hors production, tout se tait.** `robots.txt` interdit tout, le plan du site est vide,
et chaque page est en `noindex`. Une préversion indexée fait concurrence au vrai site sur
ses propres mots, et c'est Google qui choisit laquelle montrer.

**La liste des pages est écrite à la main**, dans `src/lib/seo/site.ts`. Un plan du site
qui se construirait en parcourant les dossiers annoncerait une page privée le jour où
quelqu'un en ajoute une — et le plan du site est précisément l'endroit où un moteur va
chercher ce qu'il ne connaît pas encore. Un test refuse qu'une page d'un espace privé y
entre.

### Espaces privés

`/app` et `/admin` portent un en-tête `noindex` dans leur mise en page. **`robots.txt`
n'est pas une protection** : c'est une demande polie qu'un moteur peut ignorer, et le
fichier publie la liste des chemins qu'il prétend cacher. La protection vient de
l'authentification et de RLS ; `noindex` ne sert qu'à éviter qu'une page de connexion
atteinte par un lien se retrouve dans l'index.

### Données structurées

Trois schémas sur l'accueil : `Organization`, `SoftwareApplication`, `FAQPage`. La FAQ est
déclarée parce qu'elle est **visible sur la page** — déclarer une FAQ invisible est une
infraction aux règles de Google.

**Ni `offers`, ni `aggregateRating`.** Les prix ne sont pas fixés et personne n'a noté le
produit. Les déclarer serait une donnée structurée trompeuse ; un test l'interdit.

Aucun affichage enrichi n'est promis : Google décide seul, et aucune balise ne l'oblige.

### Métadonnées

Titre unique, description, Open Graph, carte Twitter, langue `fr`, `themeColor`.

**Il manque une image de partage.** Un lien posté sur WhatsApp ou LinkedIn s'affiche
aujourd'hui sans visuel. L'écran SEO de la console le signale.

## Search Console

Rien n'est connecté, et **rien n'a été vérifié ni soumis**. Ce qui est préparé dans le
code :

- la balise de propriété s'émet dès que `GOOGLE_SITE_VERIFICATION` existe dans
  l'environnement — et seulement alors, car une balise vide se lit comme une tentative
  ratée ;
- le plan du site est à `/sitemap.xml`, prêt à être déposé ;
- l'écran `/admin/seo` affiche « Connexion nécessaire » tant que rien n'existe.

La suite demande un accès à votre compte Google et au DNS du domaine : voir
`docs/OWNER_ACTION_PLAN.md`, section D.

## Search Console : ce que la connexion fait, et ce qu'elle ne fait pas

`/admin/seo` → **Connecter Search Console**. OAuth réel, portée
`https://www.googleapis.com/auth/webmasters.readonly` — lecture seule sur les propriétés,
rien d'autre. Le client OAuth est celui de l'agenda : un seul à entretenir chez Google.

Le jeton de rafraîchissement est chiffré (AES-256-GCM) dans `search_console_connection`,
table sans aucune permission de lecture. Le jeton d'accès n'est jamais stocké : il vit une
heure et se redemande à chaque besoin.

Une fois la propriété choisie, l'écran affiche clics, impressions, position moyenne, les
dix requêtes et les dix pages qui ressortent. **La fenêtre s'arrête trois jours avant
aujourd'hui** : Google ne publie rien avant, et un zéro ressemble à une panne.

Ce que la connexion ne fait **pas** :

- **Vérifier la propriété du domaine.** Cela demanderait une portée d'écriture bien plus
  large, et un accès DNS. Se fait une fois à la main (D3).
- **Déposer le plan du site.** Même raison. Se fait une fois à la main (D4).
- **Accélérer l'indexation.** Rien ne l'accélère de façon fiable.

## Référencement page par page

`/admin/seo`, section **Référencement page par page**. Pour chaque page publique : titre,
description, priorité dans le plan du site, et trois interrupteurs — page active,
indexable, dans le plan du site.

Champ laissé vide = valeur du site reprise. C'est le cas normal.

Le chemin n'est pas saisissable. Deux verrous, indépendants l'un de l'autre :

1. `cheminAutorise()` exige que le chemin figure dans `PAGES_PUBLIQUES`
   (`lib/seo/site.ts`) — la liste des pages que le code rend réellement.
2. La contrainte `seo_pages_chemin_public` refuse en base tout chemin commençant par
   `/app`, `/admin`, `/api`, `/auth`, `/onboarding`, `/rdv`, `/invitation`,
   `/nouveau-mot-de-passe`.

Le premier empêche d'annoncer une adresse en 404 ; le second d'annoncer une page privée.

Une page entre dans le plan du site à **quatre** conditions : elle existe dans le code,
elle est publiée, elle est marquée pour le plan, elle est indexable. Et son indexabilité
ne peut pas dépasser celle du site — `siteIndexable() && page.indexable !== false`.

Ajouter une page au site se fait dans le code. Son référencement se règle ensuite ici.

## Image de partage

Téléversée, pas saisie comme adresse : une image hébergée ailleurs disparaît un jour sans
prévenir, et tous les liens déjà partagés perdent leur aperçu en silence.

PNG, JPEG ou WebP, 2 Mo maximum. Vérifié côté serveur **et** par le bucket
`public-assets`. Le nom du fichier envoyé par le navigateur est ignoré : le chemin est
construit côté serveur, parce qu'un nom venant du client est une adresse qu'il contrôle.

Chaque envoi porte un nom neuf (`partage/og-<horodatage>.<ext>`), parce que les caches des
réseaux sociaux gardent longtemps une même adresse.

Les dimensions ne sont pas vérifiées : il faudrait décoder l'image côté serveur. L'écran
annonce 1200 × 630 et montre l'aperçu — une image mal proportionnée se voit tout de suite.

## Les réglages atteignent-ils vraiment le site ?

Oui, depuis 0.19.0. Avant, non, et l'écran le prétendait.

La page d'accueil, `robots.txt` et `sitemap.xml` lisent des réglages en base. Sans
instruction, Next les prérend au moment du build : le formulaire écrivait en base et le
site affichait les valeurs figées du dernier déploiement.

Les trois portent maintenant `export const revalidate = 60`. La page reste servie en
statique — donc rapide, ce qui compte pour le référencement — et le réglage arrive dans la
minute. Les actions d'administration demandent en plus `revalidatePath` du chemin
concerné, ce qui rend le changement immédiat.

Règle générale : **ajouter une lecture en base dans une page statique est un changement de
mode de rendu, pas une modification locale.** Un test le vérifie sur les trois fichiers.

## Performance

Ce que le code fait déjà : polices auto-hébergées (aucun appel à un CDN, donc aucun
blocage de rendu), aucune bibliothèque de graphiques côté client, SVG tracés à la main,
page d'accueil rendue côté serveur sans JavaScript nécessaire à la lecture.

Ce qui n'est **pas** mesuré : les Core Web Vitals réels. Ils demandent du trafic réel, et
aucun outil ne les simule honnêtement. Ils se liront dans Search Console une fois le site
visité.

## Ce qui n'a pas été fait, délibérément

**Aucune page métier générée automatiquement.** « Sophie IA pour plombiers à Liège »,
décliné sur cent villes et douze métiers, donne mille deux cents pages identiques à un mot
près. Google appelle cela du contenu de faible qualité et l'a sanctionné bien avant 2026.
Quelques pages vraiment écrites valent mieux, et elles demandent quelqu'un qui connaît le
métier — pas un générateur.
