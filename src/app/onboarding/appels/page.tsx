import { requireStep } from "../guard";
import { StepShell } from "../step-shell";
import { PhoneForm } from "./phone-form";
import type { ZeliAnswerMode } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vos appels — Zelicall" };

export default async function PhoneStep() {
  const { organization, supabase } = await requireStep("PHONE");

  const { data } = await supabase
    .from("sophie_configurations")
    .select("answer_mode, transfer_number")
    .eq("organization_id", organization.organization_id)
    .maybeSingle();

  return (
    <StepShell
      step="PHONE"
      title="Vos appels"
      intro="Quand Zeli doit-elle décrocher ? Vous pourrez changer cela à tout moment."
      backHref="/onboarding/sophie"
    >
      <PhoneForm
        answerMode={
          (data?.answer_mode as ZeliAnswerMode | undefined) ??
          "WHEN_UNAVAILABLE"
        }
        transferNumber={
          (data?.transfer_number as string | null | undefined) ?? null
        }
      />
    </StepShell>
  );
}
