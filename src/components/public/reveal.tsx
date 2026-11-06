"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Apparition d'un bloc à son entrée dans l'écran.
 *
 * ## Pourquoi pas une bibliothèque
 *
 * Une bibliothèque d'animation coûte une cinquantaine de kilo-octets de
 * JavaScript. Sur la page d'accueil, ce poids se paie en visiteurs qui
 * partent avant l'affichage. Ce composant fait une chose, avec l'API que le
 * navigateur fournit déjà.
 *
 * ## Visible d'abord, masqué ensuite
 *
 * Le contenu est rendu par le serveur et visible sans JavaScript. C'est le
 * script qui masque, au premier rendu client, puis révèle. Si le script ne
 * s'exécute pas — bloqueur, erreur, vieux navigateur — la page reste
 * entièrement lisible. L'inverse (masquer en CSS, révéler en JS) produit une
 * page blanche chez qui n'exécute pas le script, et c'est une faute que les
 * sites commettent constamment.
 *
 * Le masquage n'a lieu que si l'observateur existe et que la personne n'a pas
 * demandé moins d'animations.
 */
export function Reveal({
  children,
  delai = 0,
  className = "",
}: {
  children: React.ReactNode;
  /** Retard en millisecondes, pour décaler les éléments d'une même rangée. */
  delai?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [cache, setCache] = useState(false);
  const [vu, setVu] = useState(false);

  useEffect(() => {
    const noeud = ref.current;
    if (!noeud) return;

    const sobre = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (sobre || typeof IntersectionObserver === "undefined") {
      setVu(true);
      return;
    }

    // On ne masque QUE ce qui est encore sous l'écran.
    //
    // Sans cette condition, un visiteur qui arrive par une ancre, qui restaure
    // sa position de défilement, ou qui saute d'un coup au bas de la page,
    // laisse derrière lui des blocs que l'observateur n'a jamais vus traverser
    // l'écran : ils restent invisibles alors que le texte est là. Une
    // animation d'apparition ne doit jamais pouvoir effacer du contenu.
    const rect = noeud.getBoundingClientRect();
    if (rect.top <= window.innerHeight) {
      setVu(true);
      return;
    }

    setCache(true);

    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (!entree.isIntersecting) continue;
          setVu(true);
          observateur.disconnect();
        }
      },
      // 12 % du bloc suffisent : attendre la moitié fait apparaître les
      // grandes sections trop tard, une fois déjà lues.
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    observateur.observe(noeud);

    // Dernier filet. Si rien ne s'est produit au bout de cinq secondes —
    // observateur silencieux, onglet en arrière-plan, bogue de navigateur —
    // on montre. Mieux vaut une apparition sans animation qu'un bloc vide.
    const filet = window.setTimeout(() => setVu(true), 5000);

    return () => {
      observateur.disconnect();
      window.clearTimeout(filet);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      data-cache={cache && !vu ? "oui" : undefined}
      data-vu={vu ? "oui" : undefined}
      style={delai ? { transitionDelay: `${delai}ms` } : undefined}
    >
      {children}
    </div>
  );
}
