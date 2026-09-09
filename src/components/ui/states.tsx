import * as React from "react";
import { Sheet } from "@/components/ui/sheet";

/**
 * Chaque ecran doit prevoir quatre etats : chargement, vide, erreur, succes
 * (section 44). Ces composants sont la reference commune.
 */

export function LoadingState({ label = "Chargement" }: { label?: string }) {
  return (
    <Sheet className="flex items-center gap-3 text-ink-soft" aria-live="polite">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-signal"
      />
      <span className="text-sm">{label}…</span>
    </Sheet>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Sheet className="flex flex-col gap-1.5 border-dashed bg-transparent">
      <p className="font-medium text-ink-soft">{title}</p>
      <p className="text-sm text-ink-faint">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </Sheet>
  );
}

export function ErrorState({
  title = "Cette information n’a pas pu être chargée",
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Sheet tone="urgent" className="flex flex-col gap-2" role="alert">
      <p className="font-semibold text-ink">{title}</p>
      <p className="text-sm text-ink-soft">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </Sheet>
  );
}
