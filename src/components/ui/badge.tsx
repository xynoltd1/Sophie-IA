import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Ton = "neutre" | "urgent" | "attention" | "signal" | "discret";

/**
 * Étiquette d'état.
 *
 * Elle remplace les `<span>` stylés à la main qui s'étaient multipliés dans
 * les listes — chacun avec ses propres couleurs et son propre arrondi. Un
 * badge ne porte jamais plus de deux mots : au-delà, c'est une phrase, et une
 * phrase se met dans le texte.
 */
const TONS: Record<Ton, string> = {
  neutre: "bg-ink-tint text-ink-soft",
  urgent: "bg-urgent-soft text-urgent",
  attention: "bg-attention-soft text-attention",
  signal: "bg-signal-soft text-signal-deep",
  discret: "border border-line text-ink-faint",
};

export function Badge({
  ton = "neutre",
  className,
  children,
}: {
  ton?: Ton;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium",
        TONS[ton],
        className,
      )}
    >
      {children}
    </span>
  );
}
