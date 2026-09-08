import * as React from "react";
import { cn } from "@/lib/utils/cn";

/** Bloc de contenu. Le rayon et la bordure encodent la hierarchie, pas le decor. */
export function Sheet({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn("rounded-sheet border border-line bg-surface p-4", className)}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-lg font-semibold text-ink">{children}</h2>;
}
