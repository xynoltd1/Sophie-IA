import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "attention" | "urgent" | "done";

/**
 * Bloc de contenu.
 *
 * `tone` ajoute une arete de statut a gauche. Elle n'est pas decorative :
 * un bloc sans arete ne demande rien a l'utilisateur, un bloc avec arete
 * signale ce qui attend une action. C'est la seule hierarchie visuelle du
 * tableau de bord, et elle doit rester rare pour rester lisible.
 */
const TONES: Record<Tone, string> = {
  neutral: "border-line",
  attention: "spine border-l-attention border-y-line border-r-line bg-attention-soft",
  urgent: "spine border-l-urgent border-y-line border-r-line bg-urgent-soft",
  done: "spine border-l-signal border-y-line border-r-line",
};

export function Sheet({
  tone = "neutral",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return (
    <div
      {...props}
      className={cn("rounded-sheet border bg-surface p-4", TONES[tone], className)}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 font-display text-lg font-semibold tracking-tight text-ink">
      {children}
    </h2>
  );
}
