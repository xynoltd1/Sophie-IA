import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * Puce de filtre.
 *
 * Même composant partout : les listes d'appels, de prospects et d'agenda
 * avaient chacune leur variante, avec des hauteurs et des couleurs
 * différentes. Un filtre doit se reconnaître d'un écran à l'autre.
 *
 * Hauteur 44 px : c'est le minimum confortable pour un pouce, et ces puces
 * sont toujours alignées horizontalement, donc serrées.
 */
export function Chip({
  href,
  actif = false,
  children,
}: {
  href: string;
  actif?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      className={cn(
        "flex min-h-11 shrink-0 items-center rounded-pill px-4 text-sm transition-colors",
        actif
          ? "bg-signal font-medium text-white"
          : "border border-line bg-surface text-ink-soft hover:border-ink-faint hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
