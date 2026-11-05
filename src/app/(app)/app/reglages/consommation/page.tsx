import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sheet, SectionTitle } from "@/components/ui/sheet";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consommation — Sophie IA" };

const LIBELLES: Record<string, { titre: string; unite: string }> = {
  VOICE_MINUTES: { titre: "Minutes d’appel", unite: "min" },
  SMS_SENT: { titre: "SMS envoyés", unite: "SMS" },
  AI_USAGE: { titre: "Résumés produits", unite: "appels" },
  STORAGE: { titre: "Enregistrements conservés", unite: "Mo" },
};

/**
 * Ce que l'entreprise a consommé ce mois-ci (section 38).
 *
 * Affiché avec le quota de son offre quand elle en a une : « 247 / 500 ».
 * Sans offre souscrite, on affiche le consommé seul plutôt qu'un quota
 * inventé.
 */
export default async function ConsommationPage() {
  const { activeOrganization } = await requireOrganization();
  // La consommation touche a la facturation : elle ne regarde pas un simple
  // membre, qui n'a pas a connaitre les engagements financiers de l'entreprise.
  if (!can(activeOrganization.role, "billing:manage"))
    redirect("/app/reglages");

  const supabase = await createServerSupabase();
  const orgId = activeOrganization.organization_id;

  const [usageRes, abonnementRes] = await Promise.all([
    supabase.rpc("usage_summary", { org_id: orgId, depuis: null }),
    supabase
      .from("subscriptions")
      .select("status, plans(label, included_voice_minutes, included_sms)")
      .eq("organization_id", orgId)
      .in("status", ["TRIAL", "ACTIVE", "PAST_DUE"])
      .maybeSingle(),
  ]);

  const usage = (usageRes.data ?? []) as { kind: string; total: number }[];
  const abonnement = abonnementRes.data as unknown as {
    status: string;
    plans: {
      label: string;
      included_voice_minutes: number;
      included_sms: number;
    } | null;
  } | null;

  const quotas: Record<string, number | null> = {
    VOICE_MINUTES: abonnement?.plans?.included_voice_minutes ?? null,
    SMS_SENT: abonnement?.plans?.included_sms ?? null,
    AI_USAGE: null,
    STORAGE: null,
  };

  const mois = new Date().toLocaleDateString("fr-BE", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/app/reglages"
        className="text-sm text-ink-soft underline underline-offset-4"
      >
        ← Réglages
      </Link>
      <SectionTitle>Consommation</SectionTitle>
      <p className="text-sm text-ink-soft first-letter:uppercase">
        {mois}
        {abonnement?.plans
          ? ` · offre ${abonnement.plans.label}`
          : " · aucune offre souscrite"}
      </p>

      <ul className="flex flex-col gap-2">
        {Object.keys(LIBELLES).map((genre) => {
          const consomme = usage.find((u) => u.kind === genre)?.total ?? 0;
          const quota = quotas[genre] ?? null;
          const part =
            quota && quota > 0 ? Math.min(100, (consomme / quota) * 100) : null;

          return (
            <li key={genre}>
              <Sheet>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">{LIBELLES[genre]?.titre}</p>
                  <p className="text-sm">
                    {arrondi(consomme)}
                    {quota !== null ? ` / ${quota}` : ""}{" "}
                    {LIBELLES[genre]?.unite}
                  </p>
                </div>
                {part !== null ? (
                  <div
                    className="mt-2 h-2 w-full overflow-hidden rounded-full bg-paper"
                    role="progressbar"
                    aria-valuenow={Math.round(part)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={LIBELLES[genre]?.titre}
                  >
                    <div
                      className={
                        part >= 90 ? "h-full bg-urgent" : "h-full bg-signal"
                      }
                      style={{ width: `${part}%` }}
                    />
                  </div>
                ) : null}
              </Sheet>
            </li>
          );
        })}
      </ul>

      <Sheet tone="neutral">
        <p className="text-sm text-ink-soft">
          Les appels d’essai ne sont pas comptés. Un appel n’est compté qu’une
          fois, même si son traitement est rejoué.
        </p>
      </Sheet>
    </div>
  );
}

function arrondi(valeur: number): string {
  return Number.isInteger(valeur) ? String(valeur) : valeur.toFixed(1);
}
