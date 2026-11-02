import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * Bande de chiffres.
 *
 * Trois nombres côte à côte, séparés par un filet vertical, dans une seule
 * surface. Trois cartes séparées donneraient trois objets à comparer ; une
 * seule surface donne une lecture — c'est ce qu'on veut d'un relevé.
 *
 * Les chiffres sont en chasse tabulaire et alignés en bas de leur ligne de
 * base : sans cela, « 7 » et « 112 » ne se comparent pas d'un coup d'œil.
 */
export function StatStrip({
  items,
}: {
  items: { valeur: number | string; label: string; href?: string }[];
}) {
  return (
    <div className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-sheet border border-line bg-surface shadow-sheet">
      {items.map((item) => {
        const contenu = (
          <>
            <span className="tabular text-stat font-semibold leading-none text-ink">
              {item.valeur}
            </span>
            <span className="mt-1.5 text-sm leading-tight text-ink-soft">{item.label}</span>
          </>
        );

        const classes = "flex flex-col items-start px-4 py-3.5";

        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className={cn(classes, "transition-colors hover:bg-signal-tint")}
          >
            {contenu}
          </Link>
        ) : (
          <div key={item.label} className={classes}>
            {contenu}
          </div>
        );
      })}
    </div>
  );
}
