import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SectionTitle, Sheet } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";
import { PlansEditor, type LignePlan } from "./editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Offres — Plateforme" };

export default async function PlansPage() {
  await requirePlatformAdmin();
  const supabase = await createServerSupabase();
  const admin = createAdminClient();

  const [plansRes, abonnementsRes] = await Promise.all([
    supabase
      .from("plans")
      .select("code, label, description, monthly_price_cents, included_voice_minutes, included_sms, max_members, is_public")
      .order("sort_order"),
    admin
      .from("subscriptions")
      .select("id, status, period_start, organizations(name), plans(label)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const abonnements = (abonnementsRes.data ?? []) as unknown as {
    id: string;
    status: string;
    period_start: string;
    organizations: { name: string } | null;
    plans: { label: string } | null;
  }[];

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionTitle>Offres</SectionTitle>
        <Sheet tone="neutral" className="mb-2">
          <p className="text-sm text-ink-soft">
            Un prix vide signifie « pas encore fixé », et non « gratuit ». Les trois
            catégories prévues existent sans tarif : il n’appartient pas au code de les
            inventer.
          </p>
        </Sheet>
        <PlansEditor plans={(plansRes.data ?? []) as LignePlan[]} />
      </section>

      <section>
        <SectionTitle>Abonnements</SectionTitle>
        {abonnements.length === 0 ? (
          <EmptyState
            title="Aucun abonnement"
            description="Les souscriptions des entreprises apparaîtront ici."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {abonnements.map((abonnement) => (
              <li key={abonnement.id}>
                <Sheet className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {abonnement.organizations?.name ?? "Entreprise supprimée"}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {abonnement.plans?.label ?? "Offre inconnue"} · depuis le{" "}
                      {new Date(abonnement.period_start).toLocaleDateString("fr-BE")}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-ink-soft">{abonnement.status}</span>
                </Sheet>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
