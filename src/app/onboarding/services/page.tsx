import { requireStep } from "../guard";
import { StepShell } from "../step-shell";
import { ServicesEditor } from "./services-editor";
import { ErrorState } from "@/components/ui/states";
import type { ServiceRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vos services — Sophie IA" };

export default async function ServicesStep() {
  const { organization, supabase } = await requireStep("SERVICES");

  const { data, error } = await supabase
    .from("services")
    .select("id, name, duration_minutes, is_urgent, is_active, price_indication, source, sort_order")
    .eq("organization_id", organization.organization_id)
    .order("sort_order");

  if (error) {
    return (
      <StepShell
        step="SERVICES"
        title="Vos services"
        intro="Vos services n'ont pas pu être chargés."
        backHref="/onboarding/metier"
      >
        <ErrorState description="Rechargez la page pour réessayer." />
      </StepShell>
    );
  }

  return (
    <StepShell
      step="SERVICES"
      title="Vos services"
      intro="Voici ce que votre métier suggère. Désactivez ce que vous ne faites pas, ajustez les durées, ajoutez ce qui manque."
      backHref="/onboarding/metier"
    >
      <ServicesEditor services={(data ?? []) as ServiceRow[]} />
    </StepShell>
  );
}
