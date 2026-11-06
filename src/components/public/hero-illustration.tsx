/**
 * L'illustration du hero.
 *
 * ## Pourquoi un SVG écrit à la main
 *
 * Mon environnement ne produit pas d'images de synthèse. Plutôt que d'annoncer
 * un rendu 3D que je n'ai pas fabriqué, ou de poser une banque d'images sans
 * rapport avec le produit, cette scène est dessinée en SVG : un téléphone, un
 * appel entrant, la voix qui répond, et le rendez-vous qui en sort.
 *
 * Le choix se défend au-delà de l'honnêteté. Ce composant est rendu par le
 * serveur, donc présent dans le HTML : il n'y a aucune requête réseau à
 * attendre, et il ne peut pas provoquer de saut de mise en page. C'est
 * l'élément le plus large de l'écran d'accueil, donc très probablement celui
 * que Google chronomètre. Une image de 400 ko l'aurait retardé de plusieurs
 * centaines de millisecondes ; un moteur 3D, de plusieurs secondes.
 *
 * ## Ce qu'elle montre, et pourquoi pas un robot
 *
 * Un robot humanoïde ne dit rien du produit. Ici, chaque pièce est une étape
 * réelle : l'appel arrive, la voix répond, le rendez-vous se prépare. Le
 * visiteur comprend le service sans lire une ligne.
 *
 * ## Accessibilité
 *
 * `role="img"` et un titre décrivant la scène. Les textes à l'intérieur du
 * dessin sont décoratifs et répétés en clair dans la page : un lecteur
 * d'écran ne doit pas les énoncer deux fois, d'où `aria-hidden` sur le détail.
 */
export function IllustrationAccueil() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <svg
        viewBox="0 0 520 520"
        role="img"
        aria-labelledby="illustration-titre"
        className="h-auto w-full"
      >
        <title id="illustration-titre">
          Un téléphone reçoit un appel. Zeli répond, et un rendez-vous se
          prépare : mardi 14 h, fuite sous évier.
        </title>

        <defs>
          <linearGradient id="fond-halo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8ddcbb" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#3fb58e" stopOpacity="0" />
          </linearGradient>

          <radialGradient id="halo" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#7fd9b6" stopOpacity="0.75" />
            <stop offset="60%" stopColor="#bfe9d8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#eef1ed" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="chassis" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#14362c" />
            <stop offset="55%" stopColor="#0c2820" />
            <stop offset="100%" stopColor="#081c17" />
          </linearGradient>

          <linearGradient id="ecran" x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e8f2ed" />
          </linearGradient>

          <linearGradient id="carte" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f3f8f5" />
          </linearGradient>

          <linearGradient id="bouton-vert" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#12a271" />
            <stop offset="100%" stopColor="#0a6b4f" />
          </linearGradient>

          <linearGradient id="reflet" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Halo. Il donne la profondeur sans ombre portée, qui salirait le
            fond clair en plein soleil. */}
        <circle className="halo" cx="262" cy="248" r="210" fill="url(#halo)" />

        <g aria-hidden="true">
          {/* ------------------------------------------------- le téléphone */}
          {/* L'ombre au sol reste immobile pendant que le téléphone monte et
              descend. Une ombre qui suivrait l'objet annulerait l'effet : c'est
              l'écart entre les deux qui se lit comme de la hauteur. Une ellipse
              plate, et non un flou gaussien, qui se recalculerait à chaque
              image. */}
          <ellipse
            cx="262"
            cy="446"
            rx="88"
            ry="12"
            fill="#0e1c18"
            opacity="0.11"
          />

          <g className="flotte-lent">
            <rect
              x="180"
              y="96"
              width="164"
              height="330"
              rx="34"
              fill="url(#chassis)"
            />
            <rect
              x="188"
              y="104"
              width="148"
              height="314"
              rx="28"
              fill="url(#ecran)"
            />

            {/* Encoche */}
            <rect
              x="240"
              y="110"
              width="44"
              height="7"
              rx="3.5"
              fill="#0c2820"
              opacity="0.65"
            />

            {/* En-tête d'écran : appel entrant */}
            <text
              x="262"
              y="152"
              textAnchor="middle"
              fontSize="11"
              fill="#7f8d87"
              fontFamily="system-ui, sans-serif"
            >
              Appel entrant
            </text>

            {/* Pastille d'appelant */}
            <circle cx="262" cy="190" r="23" fill="#dcece5" />
            <path
              d="M262 180a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 17c7 0 13 3.6 13 8v2h-26v-2c0-4.4 6-8 13-8Z"
              fill="#0a6b4f"
            />

            <text
              x="262"
              y="233"
              textAnchor="middle"
              fontSize="13"
              fontWeight="600"
              fill="#0e1c18"
              fontFamily="system-ui, sans-serif"
            >
              +32 470 ·· ·· 18
            </text>

            {/* La voix de Zeli, pendant qu'elle parle. */}
            <g>
              {[
                { x: 216, h: 26, d: "0s" },
                { x: 228, h: 42, d: "0.14s" },
                { x: 240, h: 58, d: "0.07s" },
                { x: 252, h: 34, d: "0.21s" },
                { x: 264, h: 50, d: "0.03s" },
                { x: 276, h: 30, d: "0.17s" },
                { x: 288, h: 44, d: "0.1s" },
                { x: 300, h: 24, d: "0.24s" },
              ].map((barre) => (
                <rect
                  key={barre.x}
                  className="onde-voix"
                  x={barre.x}
                  y={282 - barre.h / 2}
                  width="6"
                  height={barre.h}
                  rx="3"
                  fill="#0a6b4f"
                  opacity="0.85"
                  style={{
                    transformOrigin: `${barre.x + 3}px 282px`,
                    animationDelay: barre.d,
                  }}
                />
              ))}
            </g>

            <text
              x="262"
              y="322"
              textAnchor="middle"
              fontSize="10.5"
              fill="#4d5c56"
              fontFamily="system-ui, sans-serif"
            >
              Zeli répond
            </text>

            {/* Les deux boutons du bas */}
            <rect
              x="206"
              y="346"
              width="50"
              height="50"
              rx="25"
              fill="#f0e3e0"
            />
            <path
              d="M224 364l14 14m0-14l-14 14"
              stroke="#b3210b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            <rect
              x="268"
              y="346"
              width="50"
              height="50"
              rx="25"
              fill="url(#bouton-vert)"
            />
            <path
              d="M283 365.5c3.6 6.4 7.1 9.9 13.5 13.5l4-4.6c.6-.7 1.6-.9 2.4-.5l5 2.4c.9.4 1.3 1.4 1.1 2.3l-1 4.3c-.2 1-1.1 1.6-2.1 1.5-11.6-1-20.8-10.2-21.8-21.8-.1-1 .5-1.9 1.5-2.1l4.3-1c.9-.2 1.9.2 2.3 1.1l2.4 5c.4.8.2 1.8-.5 2.4l-4.6 4Z"
              fill="#ffffff"
            />

            {/* Reflet sur la vitre. */}
            <path
              d="M188 132 L336 104 v60 L188 212 Z"
              fill="url(#reflet)"
              opacity="0.8"
            />
          </g>

          {/* ------------------------------- la carte de rendez-vous, à droite */}
          <g className="flotte-moyen" style={{ animationDelay: "0.9s" }}>
            <rect
              x="352"
              y="146"
              width="162"
              height="96"
              rx="18"
              fill="url(#carte)"
              stroke="#d6ded8"
            />
            <rect
              x="352"
              y="146"
              width="5"
              height="96"
              rx="2.5"
              fill="#0a6b4f"
            />

            <text
              x="372"
              y="172"
              fontSize="10"
              fill="#0a6b4f"
              fontWeight="600"
              fontFamily="system-ui, sans-serif"
            >
              À VALIDER
            </text>
            <text
              x="372"
              y="196"
              fontSize="14"
              fontWeight="600"
              fill="#0e1c18"
              fontFamily="system-ui, sans-serif"
            >
              Mardi · 14 h 00
            </text>
            <text
              x="372"
              y="216"
              fontSize="11.5"
              fill="#4d5c56"
              fontFamily="system-ui, sans-serif"
            >
              Fuite sous évier
            </text>
            <text
              x="372"
              y="232"
              fontSize="11.5"
              fill="#7f8d87"
              fontFamily="system-ui, sans-serif"
            >
              Rue des Tanneurs, Liège
            </text>
          </g>

          {/* ------------------------------------ la pastille agenda, à gauche */}
          <g className="flotte-vif" style={{ animationDelay: "0.4s" }}>
            <rect
              x="14"
              y="222"
              width="158"
              height="74"
              rx="18"
              fill="url(#carte)"
              stroke="#d6ded8"
            />
            <rect x="32" y="242" width="34" height="34" rx="9" fill="#dcece5" />
            <path
              d="M41 250h16v2H41zm-1 5h18v13a2 2 0 0 1-2 2H42a2 2 0 0 1-2-2z"
              fill="#0a6b4f"
            />
            <text
              x="78"
              y="256"
              fontSize="11"
              fill="#7f8d87"
              fontFamily="system-ui, sans-serif"
            >
              Agenda
            </text>
            <text
              x="78"
              y="274"
              fontSize="13"
              fontWeight="600"
              fill="#0e1c18"
              fontFamily="system-ui, sans-serif"
            >
              Créneau libre
            </text>
          </g>

          {/* ------------------------------------------- la pastille « SMS » */}
          <g className="flotte-moyen" style={{ animationDelay: "1.8s" }}>
            <rect
              x="26"
              y="352"
              width="142"
              height="56"
              rx="16"
              fill="url(#carte)"
              stroke="#d6ded8"
            />
            <circle cx="54" cy="380" r="11" fill="#dcece5" />
            <path
              d="M48 376h12v7a1.5 1.5 0 0 1-1.5 1.5H53l-3 3v-3h-.5A1.5 1.5 0 0 1 48 383z"
              fill="#0a6b4f"
            />
            <text
              x="74"
              y="377"
              fontSize="10.5"
              fill="#7f8d87"
              fontFamily="system-ui, sans-serif"
            >
              Confirmation
            </text>
            <text
              x="74"
              y="392"
              fontSize="12"
              fontWeight="600"
              fill="#0e1c18"
              fontFamily="system-ui, sans-serif"
            >
              SMS au client
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
