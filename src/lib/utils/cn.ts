/** Concatene des classes CSS conditionnelles sans dependance externe. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
