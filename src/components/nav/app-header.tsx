import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { InstallButton } from "@/components/pwa/install-button";

/**
 * En-tete de l’application. L’element le plus important n’est pas le logo :
 * c’est de savoir si Sophie repond ou non en ce moment.
 */
export function AppHeader({
  organizationName,
  sophieActive,
  alertes = 0,
}: {
  organizationName: string;
  sophieActive: boolean;
  /** Nombre d'alertes non lues. Zero = pas de pastille, pas de bruit. */
  alertes?: number;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <p className="min-w-0 truncate font-display text-lg font-semibold leading-tight">
          {organizationName}
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <InstallButton />
          {alertes > 0 ? (
            <Link
              href="/app/notifications"
              aria-label={`${alertes} alerte${alertes > 1 ? "s" : ""} non lue${alertes > 1 ? "s" : ""}`}
              className="flex min-h-10 min-w-10 items-center justify-center rounded-control border border-attention bg-attention-soft px-3 text-sm font-semibold text-attention"
            >
              {alertes > 9 ? "9+" : alertes}
            </Link>
          ) : null}
          <Link
            href="/app/sophie"
            className={cn(
              "flex min-h-10 items-center gap-2 rounded-control border px-3 text-sm font-medium",
              sophieActive
                ? "border-signal bg-signal-soft text-signal-deep"
                : "border-line bg-surface text-ink-soft",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 rounded-full",
                sophieActive ? "bg-signal" : "bg-ink-faint",
              )}
            />
            {sophieActive ? "Sophie répond" : "Sophie en pause"}
          </Link>
        </div>
      </div>
    </header>
  );
}
