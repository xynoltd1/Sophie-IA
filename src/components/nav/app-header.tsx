import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { InstallButton } from "@/components/pwa/install-button";

/**
 * En-tête de l'application.
 *
 * L'élément le plus important n'est pas le logo : c'est de savoir si Zeli
 * répond ou non en ce moment. Tout le reste de la barre lui cède la place.
 *
 * ## Deux corrections de hiérarchie
 *
 * Les alertes s'affichaient comme un nombre dans un cadre ambre, à côté du
 * badge de Zeli. Deux cadres de même taille côte à côte se lisent comme deux
 * états, et l'œil doit relire pour savoir lequel est lequel. Les alertes sont
 * donc redevenues ce qu'elles sont — une cloche avec une pastille — et il ne
 * reste qu'un seul objet d'état dans la barre.
 *
 * La barre est posée sur `paper-deep`, un ton à peine plus dense que le fond de
 * page. C'est ce qui la détache quand le contenu défile dessous, sans ombre
 * portée : une ombre se remarque surtout en plein soleil, où elle salit
 * l'écran au lieu de l'organiser.
 */
export function AppHeader({
  organizationName,
  sophieActive,
  alertes = 0,
}: {
  organizationName: string;
  sophieActive: boolean;
  /** Nombre d'alertes non lues. Zéro = pas de pastille, pas de bruit. */
  alertes?: number;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper-deep/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2.5">
        <p className="min-w-0 flex-1 truncate font-display text-lg font-semibold leading-tight">
          {organizationName}
        </p>

        <InstallButton />

        {alertes > 0 ? (
          <Link
            href="/app/notifications"
            aria-label={`${alertes} alerte${alertes > 1 ? "s" : ""} non lue${alertes > 1 ? "s" : ""}`}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-soft active:bg-paper"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5M10.3 19a2 2 0 0 0 3.4 0" />
            </svg>
            <span
              aria-hidden
              className="tabular absolute right-0.5 top-0.5 min-w-[1.125rem] rounded-pill bg-urgent px-1 text-center text-[0.6875rem] font-bold leading-[1.125rem] text-white"
            >
              {alertes > 9 ? "9+" : alertes}
            </span>
          </Link>
        ) : null}

        <Link
          href="/app/sophie"
          className={cn(
            "flex min-h-11 shrink-0 items-center gap-2 rounded-pill border px-3.5 text-sm font-medium",
            sophieActive
              ? "border-signal/30 bg-signal-soft text-signal-deep"
              : "border-line bg-surface text-ink-soft",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "h-2 w-2 rounded-full",
              // L'anneau n'est pas une animation : il donne au point la
              // présence d'un voyant allumé, sans rien faire clignoter.
              sophieActive ? "bg-signal ring-2 ring-signal/25" : "bg-ink-faint",
            )}
          />
          {sophieActive ? "Zeli répond" : "Zeli en pause"}
        </Link>
      </div>
    </header>
  );
}
