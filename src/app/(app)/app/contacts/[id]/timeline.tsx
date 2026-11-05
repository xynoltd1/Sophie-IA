import Link from "next/link";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import type { EvenementFil } from "@/lib/crm/timeline";

const PUCES: Record<string, string> = {
  APPEL: "Appel",
  MESSAGE_RECU: "Reçu",
  MESSAGE_ENVOYE: "Envoyé",
  RENDEZ_VOUS: "Rendez-vous",
  DEMANDE: "Demande",
};

export function FilContact({ evenements }: { evenements: EvenementFil[] }) {
  if (evenements.length === 0) return null;

  return (
    <section>
      <SectionTitle>Historique</SectionTitle>
      <ul className="flex flex-col gap-2">
        {evenements.map((evenement) => {
          const contenu = (
            <Sheet className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-ink-soft">
                  {PUCES[evenement.genre] ?? ""}
                </p>
                <p className="font-medium">{evenement.titre}</p>
                {evenement.detail ? (
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {evenement.detail}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-sm text-ink-faint first-letter:uppercase">
                {quand(evenement.quand)}
              </p>
            </Sheet>
          );

          return (
            <li key={evenement.id}>
              {evenement.href ? (
                <Link href={evenement.href} className="block">
                  {contenu}
                </Link>
              ) : (
                contenu
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function quand(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-BE", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Brussels",
  });
}
