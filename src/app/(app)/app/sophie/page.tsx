import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { etatLigneZeli } from "@/lib/crm/queries";
import { MESSAGE_SILENCE } from "@/lib/sophie/ligne";
import { isRecordingActive } from "@/lib/org/recording";
import { createServerSupabase } from "@/lib/supabase/server";
import { ASSISTANTE_PAR_DEFAUT } from "@/lib/brand";
import {
  composerAccueil,
  modelePourMoment,
  momentDeLaJournee,
} from "@/lib/sophie/greeting";

export const dynamic = "force-dynamic";
export const metadata = { title: "Zeli — Zelicall" };

/**
 * L'écran de Zeli : son état, et ce qui se règle.
 *
 * Il répond d'abord à « est-ce qu'elle répond, oui ou non, et sinon pourquoi ».
 * Une page de réglages qui ne dit pas l'état courant oblige à deviner.
 */
export default async function ZeliPage() {
  const { activeOrganization: org } = await requireOrganization();
  const supabase = await createServerSupabase();

  const [ligne, { data: config }] = await Promise.all([
    etatLigneZeli(org.organization_id),
    supabase
      .from("sophie_configurations")
      .select(
        "assistant_name, spoken_name, greeting, greeting_morning, greeting_evening",
      )
      .eq("organization_id", org.organization_id)
      .maybeSingle(),
  ]);

  const enregistre = isRecordingActive({
    recording_enabled: org.recording_enabled,
    audio_retention_days: org.audio_retention_days,
    recording_notice_required: org.recording_notice_required,
    recording_notice_text: org.recording_notice_text,
    recording_policy_accepted_at: org.recording_policy_accepted_at,
    is_test_organization: org.is_test_organization,
  });

  const silence = ligne.raison ? MESSAGE_SILENCE[ligne.raison] : null;

  // La vraie phrase, composée comme elle le sera au téléphone. Un résumé
  // approximatif ici obligerait à ouvrir l'écran pour savoir ce qui est dit.
  const accueil = apercuAccueil(org, config);

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Zeli</SectionTitle>

      <Sheet tone={silence ? "attention" : "neutral"}>
        <p className="font-display text-lg font-semibold">
          {silence ? silence.titre : "Zeli répond à vos appels"}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {silence
            ? silence.detail
            : `Les appels arrivent sur le ${ligne.numero ?? "numéro relié"}.`}
        </p>
      </Sheet>

      <section>
        <SectionTitle>Réglages</SectionTitle>
        <ul className="flex flex-col gap-2">
          <li>
            <Link href="/app/sophie/ligne" className="block">
              <Sheet
                interactive
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">Ligne téléphonique</p>
                  <p className="text-sm text-ink-soft">
                    {ligne.numero
                      ? `Les appels arrivent sur le ${ligne.numero}.`
                      : "Aucun numéro déclaré : tout appel est un essai."}
                  </p>
                </div>
                <span aria-hidden className="shrink-0 text-ink-soft">
                  →
                </span>
              </Sheet>
            </Link>
          </li>
          <li>
            <Link href="/app/sophie/accueil" className="block">
              <Sheet
                interactive
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">Accueil téléphonique</p>
                  <p className="text-sm text-ink-soft">
                    {accueil
                      ? `« ${accueil} »`
                      : "La phrase dite en décrochant, et le nom de l’assistante."}
                  </p>
                </div>
                <span aria-hidden className="shrink-0 text-ink-soft">
                  →
                </span>
              </Sheet>
            </Link>
          </li>
          <li>
            <Link href="/app/sophie/enregistrement" className="block">
              <Sheet
                interactive
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">Enregistrement des appels</p>
                  <p className="text-sm text-ink-soft">
                    {enregistre
                      ? `Conservé ${org.audio_retention_days} jours dans votre espace privé.`
                      : "Aucune copie n’est conservée chez vous."}
                  </p>
                </div>
                <span aria-hidden className="shrink-0 text-ink-soft">
                  →
                </span>
              </Sheet>
            </Link>
          </li>
        </ul>
      </section>

      <Sheet tone="neutral">
        <p className="text-sm text-ink-soft">
          Sa voix se règle chez le fournisseur vocal pour l’instant. Ce qu’elle
          a le droit de répondre se règle dans{" "}
          <Link href="/app/sophie/connaissances" className="underline">
            ses connaissances
          </Link>
          .
        </p>
      </Sheet>
    </div>
  );
}

interface ConfigAccueil {
  assistant_name?: string | null;
  spoken_name?: string | null;
  greeting?: string | null;
  greeting_morning?: string | null;
  greeting_evening?: string | null;
}

/** La phrase du moment, pour l'aperçu de la liste. */
function apercuAccueil(
  org: { name: string },
  config: ConfigAccueil | null,
): string | null {
  if (!config) return null;

  const moment = momentDeLaJournee(new Date(), "Europe/Brussels");

  return composerAccueil({
    modele: modelePourMoment({
      base: config.greeting,
      matin: config.greeting_morning,
      soir: config.greeting_evening,
      moment,
      ouvert: true,
    }),
    entreprise: config.spoken_name?.trim() || org.name,
    assistante: config.assistant_name ?? ASSISTANTE_PAR_DEFAUT,
    moment,
  });
}
