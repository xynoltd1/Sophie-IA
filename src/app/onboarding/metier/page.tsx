import { requireStep } from "../guard";
import { StepShell } from "../step-shell";
import { ProfessionPicker } from "./profession-picker";
import { ErrorState } from "@/components/ui/states";
import type { ProfessionTemplateRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Votre métier — Sophie IA" };

export default async function ProfessionStep() {
  const { organization, supabase } = await requireStep("PROFESSION");

  const [templates, profile] = await Promise.all([
    supabase
      .from("profession_templates")
      .select("id, slug, label, allows_custom_label, sort_order")
      .eq("is_published", true)
      .order("sort_order"),
    supabase
      .from("business_profiles")
      .select("profession_template_id, custom_profession_label")
      .eq("organization_id", organization.organization_id)
      .maybeSingle(),
  ]);

  if (templates.error) {
    return (
      <StepShell
        step="PROFESSION"
        title="Votre métier"
        intro="La liste des métiers n'a pas pu être chargée."
        backHref="/onboarding"
      >
        <ErrorState description="Rechargez la page. Si le problème persiste, les migrations Supabase ne sont peut-être pas appliquées." />
      </StepShell>
    );
  }

  return (
    <StepShell
      step="PROFESSION"
      title="Votre métier"
      intro="Sophie adapte son vocabulaire, ses questions et ses suggestions de services. Vous pourrez tout modifier ensuite."
      backHref="/onboarding"
    >
      <ProfessionPicker
        templates={(templates.data ?? []) as Pick<
          ProfessionTemplateRow,
          "id" | "slug" | "label" | "allows_custom_label" | "sort_order"
        >[]}
        currentTemplateId={profile.data?.profession_template_id ?? null}
        currentCustomLabel={profile.data?.custom_profession_label ?? null}
      />
    </StepShell>
  );
}
