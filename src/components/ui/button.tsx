import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-signal text-white hover:bg-signal-deep disabled:bg-ink-faint",
  secondary: "bg-surface text-ink border border-line hover:border-ink-soft",
  quiet: "bg-transparent text-ink-soft hover:text-ink hover:bg-signal-soft",
  danger: "bg-urgent text-white hover:brightness-90",
};

// 48 px minimum : l’application s’utilise avec des gants sur un chantier.
const SIZES: Record<Size, string> = {
  md: "min-h-12 px-4 text-[0.9375rem]",
  lg: "min-h-14 px-6 text-base w-full",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-control font-medium",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-70",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? "Un instant…" : children}
    </button>
  );
}
