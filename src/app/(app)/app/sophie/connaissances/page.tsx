import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/states";
import { can } from "@/lib/auth/permissions";
import { ConnaissancesEditor, type LigneConnaissance } from "./editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connaissances de Sophie — Sophie IA" };

/**
 * Sophie → Connaissances (section 9).
 *
 * Le seul moyen de corriger Sophie, et le seul endroit d'où vient ce qu'elle
 * sait en plus de vos services et horaires. Le cahier des charges interdit
 * l'apprentissage autonome à partir des appels : ce qu'elle dit doit avoir été
 * écrit par un humain qui en répond.
 */
export default async function ConnaissancesPage() {
  const { activeOrganization } = await requireOrganization();
  if (!can(activeOrganization.role, "sophie:configure")) redirect("/app/sophie");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("business_knowledge")
    .select("id, kind, question, answer, is_active")
    .eq("organization_id", activeOrganization.organization_id)
    .order("kind")
    .order("sort_order");

  return (
    <div className="flex flex-col gap-5">
      <Link href="/app/sophie" className="text-sm text-ink-soft underline underline-offset-4">
        ← Sophie
      </Link>
      <SectionTitle>Connaissances de Sophie</SectionTitle>

      <Sheet tone="neutral">
        <p className="text-sm text-ink-soft">
          Sophie ne dit que ce qu’elle sait d’ici, de vos services et de vos horaires. Elle
          n’invente jamais un tarif ni une disponibilité : quand elle ne sait pas, elle dit
          qu’elle transmet la question.
        </p>
      </Sheet>

      {error ? (
        <ErrorState description="Les connaissances n’ont pas pu être chargées." />
      ) : (
        <ConnaissancesEditor entrees={(data ?? []) as LigneConnaissance[]} />
      )}
    </div>
  );
}
