import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { isRecordingActive, recordingBlockers } from "@/lib/org/recording";
import { RecordingForm } from "./recording-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enregistrement des appels — Sophie IA" };

/**
 * Réglage de l'enregistrement des appels (sections 13, 40 et 42).
 *
 * Cette page dit d'abord ce qui est vrai, et demande ensuite. L'ordre inverse —
 * une case à cocher suivie d'une explication — est la façon habituelle de faire
 * accepter quelque chose que personne ne lit.
 *
 * Elle distingue deux choses que tout le monde confond, et c'est le coeur du
 * sujet : le fournisseur de téléphonie enregistre de son côté, selon ses
 * propres règles ; ce réglage ne gouverne QUE la copie conservée ici.
 */
export default async function EnregistrementPage() {
  const { activeOrganization: org } = await requireOrganization();

  const politique = {
    recording_enabled: org.recording_enabled,
    audio_retention_days: org.audio_retention_days,
    recording_notice_required: org.recording_notice_required,
    recording_notice_text: org.recording_notice_text,
    recording_policy_accepted_at: org.recording_policy_accepted_at,
    is_test_organization: org.is_test_organization,
  };

  const actif = isRecordingActive(politique);
  const obstacles = recordingBlockers(politique, null);
  const modifiable = org.role === "OWNER" || org.role === "ADMIN";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/app/sophie" className="text-sm text-ink-soft underline underline-offset-4">
          ← Sophie
        </Link>
      </div>

      <SectionTitle>Enregistrement des appels</SectionTitle>

      <Sheet tone={actif ? "neutral" : "attention"}>
        <p className="font-medium">
          {actif
            ? "Vos appels sont conservés dans votre espace privé."
            : "Aucun enregistrement n’est conservé chez vous aujourd’hui."}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Votre opérateur téléphonique, lui, enregistre selon ses propres règles. Ce réglage
          ne décide que d’une chose : garder ou non une copie chez vous, dans un espace
          privé, où vous seule pouvez l’écouter.
        </p>
      </Sheet>

      <section>
        <SectionTitle>Ce que ça implique</SectionTitle>
        <Sheet className="flex flex-col gap-3 text-sm text-ink-soft">
          <p>
            <span className="font-medium text-ink">Vos clients doivent être prévenus.</span>{" "}
            Sophie l’annonce au début de chaque appel. Cette annonce n’est pas désactivable.
          </p>
          <p>
            <span className="font-medium text-ink">Le fichier reste privé.</span> Il n’est
            jamais accessible par une adresse publique. Chaque écoute passe par une adresse
            temporaire, créée après vérification que l’appel vous appartient.
          </p>
          <p>
            <span className="font-medium text-ink">Il s’efface tout seul.</span> Au-delà du
            délai que vous choisissez, l’enregistrement est supprimé. Trente jours au
            maximum, et cette limite est dans la base de données, pas seulement dans cet
            écran.
          </p>
          <p>
            <span className="font-medium text-ink">Un client peut demander l’effacement.</span>{" "}
            C’est son droit, et vous devez pouvoir y répondre.
          </p>
        </Sheet>
      </section>

      {obstacles.length > 0 ? (
        <section>
          <SectionTitle>Ce qui manque pour les appels réels</SectionTitle>
          <Sheet tone="attention">
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              {obstacles.map((obstacle) => (
                <li key={obstacle}>{obstacle}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-ink-soft">
              Ces points n’empêchent pas vos appels d’essai d’être conservés. Ils doivent
              être levés avant le premier appel d’un vrai client.
            </p>
          </Sheet>
        </section>
      ) : null}

      <RecordingForm
        accepteInitial={org.recording_policy_accepted_at !== null}
        enregistreInitial={org.recording_enabled}
        retentionInitiale={org.audio_retention_days}
        modifiable={modifiable}
      />
    </div>
  );
}
