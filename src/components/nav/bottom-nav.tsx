"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Navigation principale (section 30). Cinq destinations, jamais plus.
 *
 * Les icones ne sont pas decoratives : un texte seul se lit, une icone se
 * reconnait. L'artisan jette un oeil a son telephone entre deux gestes, il ne
 * lit pas cinq mots pour choisir.
 */
const ITEMS = [
  {
    href: "/app",
    label: "Accueil",
    path: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5",
  },
  {
    href: "/app/prospects",
    label: "Prospects",
    path: "M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1.5a4 4 0 0 0-3-3.87M16 4.13a4 4 0 0 1 0 7.75",
  },
  {
    href: "/app/agenda",
    label: "Agenda",
    path: "M4 6.5h16V20H4zM4 10.5h16M8.5 3v3.5M15.5 3v3.5",
  },
  {
    href: "/app/appels",
    label: "Appels",
    path: "M20 16.5v2.5a1.5 1.5 0 0 1-1.7 1.5A18 18 0 0 1 3.5 5.7 1.5 1.5 0 0 1 5 4h2.5a1.5 1.5 0 0 1 1.5 1.3c.1.9.3 1.7.6 2.5a1.5 1.5 0 0 1-.4 1.6L8.2 10.4a14 14 0 0 0 5.4 5.4l1-1a1.5 1.5 0 0 1 1.6-.3c.8.3 1.6.5 2.5.6a1.5 1.5 0 0 1 1.3 1.4Z",
  },
  {
    href: "/app/plus",
    label: "Plus",
    path: "M5 12h14M12 5v14",
  },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl">
        {ITEMS.map((item) => {
          const active =
            item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
                  active ? "text-signal" : "text-ink-soft",
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2.2 : 1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={item.path} />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
