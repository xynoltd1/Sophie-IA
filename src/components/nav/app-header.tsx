import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * En-tete de l’application. L’element le plus important n’est pas le logo :
 * c’est de savoir si Sophie repond ou non en ce moment.
 */
export function AppHeader({
  organizationName,
  sophieActive,
}: {
  organizationName: string;
  sophieActive: boolean;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold leading-tight">
            {organizationName}
          </p>
        </div>
        <Link
          href="/app/sophie"
          className={cn(
            "flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium",
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
          {sophieActive ? "Sophie repond" : "Sophie en pause"}
        </Link>
      </div>
    </header>
  );
}
