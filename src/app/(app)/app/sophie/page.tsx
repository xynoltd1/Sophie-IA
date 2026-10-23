import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { etatLigneSophie } from "@/lib/crm/queries";
import { MESSAGE_SILENCE } from "@/lib/sophie/ligne";
import { isRecordingActive } from "@/lib/org/recording";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sophie — Sophie IA" };

/**
 * L'écran de Sophie : son état, et ce qui se règle.
 *
 * Il répond d'abord à « est-ce qu'elle répond, oui ou non, et sinon pourquoi ».
 * Une page de réglages qui ne dit pas l'état courant oblige à deviner.
 */
export default async function SophiePage() {
  const { activeOrganization: org } = await requireOrganization();
  const ligne = await etatLigneSophie(org.organization_id);

  const enregistre = isRecordingActive({
    recording_enabled: org.recording_enabled,
    audio_retention_days: org.audio_retention_days,
    recording_notice_required: org.recording_notice_required,
    recording_notice_text: org.recording_notice_text,
    recording_policy_accepted_at: org.recording_policy_accepted_at,
    is_test_organization: org.is_test_organization,
  });

  const silence = ligne.raison ? MESSAGE_SILENCE[ligne.raison] : null;

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Sophie</SectionTitle>

      <Sheet tone={silence ? "attention" : "neutral"}>
        <p className="font-display text-lg font-semibold">
          {silence ? silence.titre : "Sophie répond à vos appels"}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {silence ? silence.detail : `Les appels arrivent sur le ${ligne.numero}.`}
        </p>
      </Sheet>

      <section>
        <SectionTitle>Réglages</SectionTitle>
        <ul className="flex flex-col gap-2">
          <li>
            <Link href="/app/sophie/enregistrement" className="block">
              <Sheet className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">Enregistrement des appels</p>
                  <p className="text-sm text-ink-soft">
                    {enregistre
                      ? `Conservé ${org.audio_retention_days} jours dans votre espace privé.`
                      : "Aucune copie n’est conservée chez vous."}
                  </p>
                </div>
                <span aria-hidden className="shrink-0 text-ink-soft">→</span>
              </Sheet>
            </Link>
          </li>
        </ul>
      </section>

      <Sheet tone="neutral">
        <p className="text-sm text-ink-soft">
          Sa voix, son vocabulaire et ses connaissances se règleront ici. Ces écrans
          arrivent après l’audio.
        </p>
      </Sheet>
    </div>
  );
}
