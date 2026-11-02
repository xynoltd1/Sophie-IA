import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { isRecordingActive } from "@/lib/org/recording";
import {
  DEFAUT_RETENTION_DAYS,
  dureeLisible,
  type RetentionSettings,
} from "@/lib/org/retention";
import { RetentionForm } from "./retention-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conservation — Sophie IA" };

/**
 * Combien de temps Sophie garde ce qu'elle a entendu.
 *
 * L'audio a son propre écran parce qu'il a sa propre contrainte : 30 jours au
 * maximum, et une acceptation préalable. Les trois autres durées se règlent
 * ici, et la page dit laquelle est laquelle plutôt que de renvoyer le
 * professionnel d'un écran à l'autre.
 */
export default async function ConservationPage() {
  const { activeOrganization: org } = await requireOrganization();

  // Les durées disent quelles traces l'entreprise garde de ses clients. Ce
  // n'est pas une information à montrer à tous ses employés.
  if (!can(org.role, "organization:update")) redirect("/app/reglages");

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("organizations")
    .select(
      "transcript_retention_days, summary_retention_days, message_retention_days",
    )
    .eq("id", org.organization_id)
    .maybeSingle();

  const initial: RetentionSettings = {
    transcript_retention_days:
      (data?.transcript_retention_days as number | undefined) ??
      DEFAUT_RETENTION_DAYS,
    summary_retention_days:
      (data?.summary_retention_days as number | undefined) ??
      DEFAUT_RETENTION_DAYS,
    message_retention_days:
      (data?.message_retention_days as number | undefined) ??
      DEFAUT_RETENTION_DAYS,
  };

  const enregistre = isRecordingActive({
    recording_enabled: org.recording_enabled,
    audio_retention_days: org.audio_retention_days,
    recording_notice_required: org.recording_notice_required,
    recording_notice_text: org.recording_notice_text,
    recording_policy_accepted_at: org.recording_policy_accepted_at,
    is_test_organization: org.is_test_organization,
  });

  const modifiable = can(org.role, "organization:update");

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Conservation des données</SectionTitle>

      <Sheet tone="neutral">
        <p className="text-sm text-ink-soft">
          Passé le délai que vous fixez, la donnée est supprimée définitivement.
          La suppression tourne une fois par jour et ne peut pas être annulée.
          La fiche d’appel elle-même reste : seul son contenu s’efface.
        </p>
      </Sheet>

      <RetentionForm initial={initial} modifiable={modifiable} />

      <section className="flex flex-col gap-2">
        <SectionTitle>Enregistrement audio</SectionTitle>
        <Link href="/app/sophie/enregistrement" className="block">
          <Sheet
            interactive
            className="flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {enregistre
                  ? `Conservé ${dureeLisible(org.audio_retention_days)}`
                  : "Aucun enregistrement conservé"}
              </p>
              <p className="text-sm text-ink-soft">
                L’audio a sa propre durée, plafonnée à 30 jours, et se règle sur
                son écran.
              </p>
            </div>
            <span aria-hidden className="shrink-0 text-ink-soft">
              →
            </span>
          </Sheet>
        </Link>
      </section>

      <Sheet tone="attention">
        <p className="text-sm font-medium">Durées à faire valider</p>
        <p className="mt-1 text-sm">
          Les valeurs par défaut — un an — sont un choix technique, pas un avis
          juridique. La durée correcte dépend de votre pays et de votre métier.
          Faites-les valider avant de commercialiser.
        </p>
      </Sheet>
    </div>
  );
}
