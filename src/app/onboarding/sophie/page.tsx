import { requireStep } from "../guard";
import { StepShell } from "../step-shell";
import { ZeliForm } from "./sophie-form";
import type { ZeliConfigurationRow } from "@/types/database";
import { ASSISTANTE_PAR_DEFAUT } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const metadata = { title: "Zeli — Zelicall" };

export default async function ZeliStep() {
  const { organization, supabase } = await requireStep("SOPHIE");

  const { data } = await supabase
    .from("sophie_configurations")
    .select("assistant_name, style, greeting, behavior_notes, disclose_ai")
    .eq("organization_id", organization.organization_id)
    .maybeSingle();

  const config = data as Pick<
    ZeliConfigurationRow,
    "assistant_name" | "style" | "greeting" | "behavior_notes" | "disclose_ai"
  > | null;

  return (
    <StepShell
      step="SOPHIE"
      title="Zeli"
      intro="Son nom, son ton, sa façon de vous présenter. Vous pourrez tout ajuster après l'avoir entendue."
      backHref="/onboarding/agenda"
    >
      <ZeliForm
        organizationName={organization.name}
        assistantName={config?.assistant_name ?? ASSISTANTE_PAR_DEFAUT}
        style={config?.style ?? "CHALEUREUX"}
        greeting={config?.greeting ?? null}
        behaviorNotes={config?.behavior_notes ?? null}
        discloseAi={config?.disclose_ai ?? true}
      />
    </StepShell>
  );
}
