import Image from "next/image";

/**
 * Une illustration de section.
 *
 * ## Pourquoi un fichier et non du SVG dans la page
 *
 * L'illustration du hero est écrite directement dans la page : c'est le plus
 * grand élément du premier écran, donc celui que Google chronomètre, et
 * l'avoir dans le HTML évite d'attendre une requête.
 *
 * Les autres sont différentes. Elles sont sous la ligne de flottaison, elles
 * pèsent ensemble une soixantaine de kilo-octets, et les écrire dans la page
 * alourdirait chaque chargement de tout ce que le visiteur n'a pas encore
 * déroulé. En fichiers, elles se chargent quand on approche, et le navigateur
 * les garde en cache d'une visite à l'autre.
 *
 * ## Pourquoi les dimensions sont obligatoires
 *
 * Sans `width` et `height`, le navigateur ne connaît pas la place à réserver :
 * le texte saute au moment où l'image arrive. C'est la faute que Google
 * mesure sous le nom de décalage de mise en page, et elle est entièrement
 * évitable.
 *
 * ## Les animations vivent dans le fichier
 *
 * Une image chargée par une balise `img` n'hérite d'aucune feuille de style
 * de la page. Chaque fichier porte donc ses propres `@keyframes` — et sa
 * propre règle `prefers-reduced-motion`, sans quoi la préférence de la
 * personne serait ignorée précisément là où ça bouge.
 */
export function Illustration({
  nom,
  alt,
  largeur,
  hauteur,
  priorite = false,
  className = "",
}: {
  /** Le nom du fichier dans `public/illustrations`, sans l'extension. */
  nom: string;
  /** Ce que l'image montre, pour qui ne la voit pas. Jamais vide. */
  alt: string;
  largeur: number;
  hauteur: number;
  priorite?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={`/illustrations/${nom}.svg`}
      alt={alt}
      width={largeur}
      height={hauteur}
      priority={priorite}
      loading={priorite ? undefined : "lazy"}
      // `unoptimized` : Next ne retouche pas un SVG, et le faire passer par
      // l'optimiseur d'images le transformerait en requête serveur inutile.
      unoptimized
      className={`h-auto w-full ${className}`}
    />
  );
}
