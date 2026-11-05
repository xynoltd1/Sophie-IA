import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/auth/session";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { can } from "@/lib/auth/permissions";
import {
  INTEGRATIONS,
  STATUS_LABELS,
  missingEnvFor,
} from "@/lib/providers/status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Intégrations — Sophie IA" };

/**
 * L'état réel des services externes.
 *
 * Cet écran existe parce que le projet a passé une journée entière à croire
 * qu'une intégration fonctionnait alors qu'elle était désactivée. Il affiche
 * ce que le registre déclare ET ce qui manque réellement dans la
 * configuration du serveur — deux informations qui peuvent se contredire, et
 * c'est précisément la contradiction qu'on veut voir.
 */
const TONES = {
  TESTED: "neutral",
  PRODUCTION_READY: "neutral",
  IMPLEMENTED_UNTESTED: "attention",
  BLOCKED_EXTERNAL_CONFIG: "attention",
} as const;

export default async function IntegrationsPage() {
  const { activeOrganization } = await requireOrganization();
  if (!can(activeOrganization.role, "organization:update"))
    redirect("/app/reglages");

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/app/reglages"
        className="text-sm text-ink-soft underline underline-offset-4"
      >
        ← Réglages
      </Link>
      <SectionTitle>Intégrations</SectionTitle>
      <p className="text-sm text-ink-soft">
        Ce qui est branché et ce qui attend une clé. Un service peut être écrit,
        testé, ou simplement en attente de configuration : les trois sont des
        états différents.
      </p>

      <ul className="flex flex-col gap-2">
        {INTEGRATIONS.map((integration) => {
          const manquantes = missingEnvFor(integration.key);

          return (
            <li key={integration.key}>
              <Sheet tone={TONES[integration.status]}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{integration.label}</p>
                  <span className="shrink-0 text-sm text-ink-soft">
                    {STATUS_LABELS[integration.status]}
                  </span>
                </div>

                {integration.blockedBy ? (
                  <p className="mt-1 text-sm text-ink-soft">
                    {integration.blockedBy}
                  </p>
                ) : null}

                {manquantes.length > 0 ? (
                  <p className="mt-1 text-sm text-attention">
                    Manque sur le serveur : {manquantes.join(", ")}
                  </p>
                ) : null}

                {integration.notes ? (
                  <p className="mt-2 text-sm text-ink-soft">
                    {integration.notes}
                  </p>
                ) : null}
              </Sheet>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
