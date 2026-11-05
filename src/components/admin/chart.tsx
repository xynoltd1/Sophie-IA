/**
 * Deux graphiques, tracés à la main.
 *
 * Pas de bibliothèque : trois courbes et deux histogrammes ne valent pas cent
 * kilo-octets de JavaScript côté client, et chaque bibliothèque impose sa
 * palette, qu'il faut ensuite combattre pour retrouver la sienne.
 *
 * Chaque graphique porte un tableau équivalent, invisible à l'œil et lu par
 * les lecteurs d'écran. Un graphique sans équivalent textuel n'est une
 * information que pour une partie des gens.
 */

export interface Point {
  label: string;
  valeur: number;
}

const HAUTEUR = 120;
const LARGEUR = 600;

function echelle(points: Point[]): number {
  const max = Math.max(...points.map((p) => p.valeur), 0);
  // Jamais zéro : une division par zéro aplatit la courbe sur l'axe et donne
  // l'impression qu'il ne s'est rien passé.
  return max === 0 ? 1 : max;
}

export function Courbe({
  points,
  titre,
  unite = "",
}: {
  points: Point[];
  titre: string;
  unite?: string;
}) {
  if (points.length === 0) return null;

  const max = echelle(points);
  const pas = points.length > 1 ? LARGEUR / (points.length - 1) : LARGEUR;

  const coordonnees = points.map((point, index) => {
    const x = index * pas;
    const y = HAUTEUR - (point.valeur / max) * (HAUTEUR - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const aire = `0,${HAUTEUR} ${coordonnees.join(" ")} ${LARGEUR},${HAUTEUR}`;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${titre} : ${points[0]?.label} à ${points[points.length - 1]?.label}, maximum ${max}${unite}`}
        className="h-32 w-full"
      >
        <polygon className="serie-aire" points={aire} />
        <polyline className="serie-ligne" points={coordonnees.join(" ")} />
      </svg>

      <table className="lecteur-seul">
        <caption>{titre}</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>
                {point.valeur}
                {unite}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function Histogramme({
  points,
  titre,
  unite = "",
}: {
  points: Point[];
  titre: string;
  unite?: string;
}) {
  if (points.length === 0) return null;
  const max = echelle(points);

  return (
    <figure className="m-0">
      <ul className="flex flex-col gap-2" aria-label={titre}>
        {points.map((point) => (
          <li key={point.label} className="flex items-center gap-3">
            <span className="w-36 shrink-0 truncate text-sm text-ink-soft">
              {point.label}
            </span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-pill bg-ink-tint">
              <span
                className="block h-full rounded-pill bg-signal"
                style={{ width: `${Math.max((point.valeur / max) * 100, 1)}%` }}
              />
            </span>
            <span className="tabular w-16 shrink-0 text-right text-sm font-medium">
              {point.valeur}
              {unite}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
