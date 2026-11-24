# Une vraie base, pour de vrais tests

Les tests de ce dépôt ne parlent pas à PostgreSQL. Ils lisent du texte. C'est
pour cela que trois bogues de suite sont passés : une colonne inventée, un
GRANT de table oublié, un droit d'exécution de fonction perdu — tous invisibles
à 500 tests verts, tous visibles en une minute sur une vraie base.

Ce dossier monte un PostgreSQL local, y applique les migrations dans l'ordre,
et joue un parcours complet avec les vrais rôles (`authenticated`,
`service_role`) et les vraies politiques d'isolation.

## Lancer

    bash scripts/base-locale.sh

Il faut PostgreSQL 16 installé (les binaires serveur, pas seulement `psql`).
Aucun accès à Supabase n'est nécessaire, et aucune clé : la base est locale,
jetable, et ne contient que des données inventées.

## Ce que le parcours vérifie

- les totaux d'un devis sont calculés par la base, pas par le navigateur ;
- la jointure contact utilisée par les écrans trouve ses colonnes ;
- la numérotation s'exécute avec le rôle serveur et respecte la contrainte
  `quotes_reference_coherente` ;
- une autre entreprise ne voit pas le devis.

## Quand l'étendre

À chaque fois qu'un bogue échappe aux tests parce qu'il vivait dans la base.
Un parcours ajouté ici coûte dix lignes et se rejoue à chaque fois.
