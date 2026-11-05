import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Réglages — Sophie IA" };

/**
 * Le point d'entrée des réglages d'entreprise.
 *
 * Tout ce qui se décide pendant l'inscription doit pouvoir se changer ensuite.
 * Une configuration qu'on ne peut plus modifier oblige à tout recommencer pour
 * un tarif qui change.
 */
const ENTREES = [
  {
    href: "/app/reglages/services",
    titre: "Services",
    detail: "Ce que vous proposez, la durée et le caractère urgent.",
    permission: "organization:update" as const,
  },
  {
    href: "/app/reglages/horaires",
    titre: "Horaires",
    detail: "Vos jours et heures de travail, la durée standard et la marge.",
    permission: "organization:update" as const,
  },
  {
    href: "/app/reglages/absences",
    titre: "Absences et vacances",
    detail: "Les périodes où Sophie ne doit proposer aucun rendez-vous.",
    permission: "organization:update" as const,
  },
  {
    href: "/app/sophie/ligne",
    titre: "Ligne téléphonique",
    detail:
      "Le numéro sur lequel Sophie répond, et comment y renvoyer vos appels.",
    permission: "organization:update" as const,
  },
  {
    href: "/app/sophie/connaissances",
    titre: "Connaissances de Sophie",
    detail:
      "Ce qu'elle a le droit de répondre : questions fréquentes et consignes.",
    permission: "sophie:configure" as const,
  },
  {
    href: "/app/sophie/enregistrement",
    titre: "Enregistrement des appels",
    detail: "Conserver ou non une copie des appels, et combien de temps.",
    permission: "organization:update" as const,
  },
  {
    href: "/app/reglages/conservation",
    titre: "Conservation des données",
    detail: "Combien de temps garder transcriptions, résumés et messages.",
    permission: "organization:update" as const,
  },
  {
    href: "/app/reglages/consommation",
    titre: "Consommation",
    detail: "Minutes d'appel, SMS et résumés consommés ce mois-ci.",
    permission: "billing:manage" as const,
  },
  {
    href: "/app/reglages/integrations",
    titre: "Intégrations",
    detail:
      "Ce qui est branché, ce qui attend une clé, ce qui n'est pas testé.",
    permission: "organization:update" as const,
  },
];

export default async function ReglagesPage() {
  const { activeOrganization } = await requireOrganization();

  const visibles = ENTREES.filter((entree) =>
    can(activeOrganization.role, entree.permission),
  );

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Réglages</SectionTitle>

      {visibles.length === 0 ? (
        <Sheet>
          <p className="text-sm text-ink-soft">
            Votre rôle ne permet pas de modifier les réglages de l’entreprise.
          </p>
        </Sheet>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((entree) => (
            <li key={entree.href}>
              <Link href={entree.href} className="block">
                <Sheet
                  interactive
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{entree.titre}</p>
                    <p className="text-sm text-ink-soft">{entree.detail}</p>
                  </div>
                  <span aria-hidden className="shrink-0 text-ink-soft">
                    →
                  </span>
                </Sheet>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
