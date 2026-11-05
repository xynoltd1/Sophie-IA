import * as React from "react";
import { cn } from "@/lib/utils/cn";

/** Carte de la console. Plus sobre que celles de l'application : on en empile beaucoup. */
export function Carte({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-sheet border border-line bg-surface p-5 shadow-sheet",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TitreSection({
  children,
  detail,
}: {
  children: React.ReactNode;
  detail?: string;
}) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        {children}
      </h2>
      {detail ? <p className="mt-0.5 text-sm text-ink-soft">{detail}</p> : null}
    </div>
  );
}

/**
 * Un chiffre et son nom.
 *
 * `indisponible` est aussi important que la valeur. Une métrique qu'on ne sait
 * pas calculer doit le dire : afficher zéro à sa place est un mensonge, et un
 * tiret laisse croire à une panne. La raison est écrite à côté.
 */
export function Chiffre({
  valeur,
  libelle,
  detail,
  indisponible,
}: {
  valeur?: number | string;
  libelle: string;
  detail?: string;
  indisponible?: string;
}) {
  return (
    <div className="rounded-sheet border border-line bg-surface p-4 shadow-sheet">
      <p className="text-sm text-ink-soft">{libelle}</p>
      {indisponible ? (
        <>
          <p className="mt-1.5 font-display text-base font-medium text-ink-faint">
            Non disponible
          </p>
          <p className="mt-0.5 text-xs leading-snug text-ink-faint">
            {indisponible}
          </p>
        </>
      ) : (
        <>
          <p className="tabular mt-1 text-stat font-semibold">{valeur}</p>
          {detail ? (
            <p className="mt-0.5 text-xs text-ink-faint">{detail}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Tableau de la console : un seul style, partout. */
export function Tableau({
  entetes,
  children,
}: {
  entetes: readonly string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-sheet border border-line bg-surface shadow-sheet">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            {entetes.map((entete) => (
              <th
                key={entete}
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-left font-medium text-ink-soft"
              >
                {entete}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
