import { requireStep } from "../guard";
import { StepShell } from "../step-shell";
import { SophieForm } from "./sophie-form";
import type { SophieConfigurationRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sophie — Sophie IA" };

export default async function SophieStep() {
  const { organization, supabase } = await requireStep("SOPHIE");

  const { data } = await supabase
    .from("sophie_configurations")
    .select("assistant_name, style, greeting, behavior_notes, disclose_ai")
    .eq("organization_id", organization.organization_id)
    .maybeSingle();

  const config = data as Pick<
    SophieConfigurationRow,
    "assistant_name" | "style" | "greeting" | "behavior_notes" | "disclose_ai"
  > | null;

  return (
    <StepShell
      step="SOPHIE"
      title="Sophie"
      intro="Son nom, son ton, sa façon de vous présenter. Vous pourrez tout ajuster après l'avoir entendue."
      backHref="/onboarding/agenda"
    >
      <SophieForm
        organizationName={organization.name}
        assistantName={config?.assistant_name ?? "Sophie"}
        style={config?.style ?? "CHALEUREUX"}
        greeting={config?.greeting ?? null}
        behaviorNotes={config?.behavior_notes ?? null}
        discloseAi={config?.disclose_ai ?? true}
      />
    </StepShell>
  );
}
