"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

/** Navigation principale (section 30). Cinq destinations, jamais plus. */
const ITEMS = [
  { href: "/app", label: "Accueil" },
  { href: "/app/prospects", label: "Prospects" },
  { href: "/app/agenda", label: "Agenda" },
  { href: "/app/appels", label: "Appels" },
  { href: "/app/plus", label: "Plus" },
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
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                  active ? "text-signal" : "text-ink-soft",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-1 w-6 rounded-full",
                    active ? "bg-signal" : "bg-transparent",
                  )}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
