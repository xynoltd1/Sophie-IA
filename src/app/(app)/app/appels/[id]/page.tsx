import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/states";
import {
  CALL_STATUS_LABELS,
  formatCallMoment,
  formatDuration,
  formatPhone,
  processingLabel,
  sansSuite,
} from "@/lib/crm/calls";
import { APPOINTMENT_STATUS_LABELS, formatDay, formatTime } from "@/lib/crm/agenda";
import { LEAD_STATUS_LABELS } from "@/lib/crm/pipeline";
import type { AppointmentRow, CallRow, LeadRow, TaskRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appel — Sophie IA" };

/**
 * Fiche d'un appel (section 31).
 *
 * L'ordre des blocs n'est pas décoratif. Un artisan sur un chantier ouvre cette
 * page pour une seule raison : savoir s'il doit rappeler, et quoi dire. Donc
 * d'abord qui a appelé, puis ce qu'il voulait, puis seulement les détails.
 *
 * Le lecteur audio est une exigence V1 et non une option. Quand l'audio n'est
 * pas encore là, la page dit pourquoi au lieu de ne rien afficher : un bloc
 * vide fait croire à une panne, et le silence est la pire des réponses.
 */
export default async function FicheAppelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("calls")
    .select("*, contacts(id, full_name, company_name, phone, city)")
    .eq("id", id)
    .eq("organization_id", activeOrganization.organization_id)
    .maybeSingle();

  if (error) return <ErrorState description="Cet appel n’a pas pu être chargé." />;
  if (!data) notFound();

  const appel = data as unknown as CallRow & {
    contacts: {
      id: string;
      full_name: string | null;
      company_name: string | null;
      phone: string | null;
      city: string | null;
    } | null;
  };

  // Ce que cet appel a produit.
  //
  // Le lien est direct depuis la migration 0022. Avant, il était déduit du
  // contact et d'une fenêtre de temps : cette déduction se trompait dès que le
  // même client rappelait dans la journée, et elle ne permettait pas de
  // répondre à la question « cet appel a-t-il donné quelque chose ? ».
  const orgId = activeOrganization.organization_id;
  const [rdvs, demandes, rappels] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, title, starts_at, ends_at, status")
      .eq("organization_id", orgId)
      .eq("call_id", id)
      .order("starts_at")
      .limit(5),
    supabase
      .from("leads")
      .select("id, title, status, priority")
      .eq("organization_id", orgId)
      .eq("call_id", id)
      .limit(5),
    supabase
      .from("tasks")
      .select("id, title, due_at, status")
      .eq("organization_id", orgId)
      .eq("call_id", id)
      .limit(5),
  ]);

  const rdv = (rdvs.data?.[0] ?? null) as Pick<
    AppointmentRow,
    "id" | "title" | "starts_at" | "ends_at" | "status"
  > | null;

  const leads = (demandes.data ?? []) as Pick<
    LeadRow,
    "id" | "title" | "status" | "priority"
  >[];

  const taches = (rappels.data ?? []) as Pick<TaskRow, "id" | "title" | "due_at" | "status">[];

  // Un appel terminé dont rien n'est sorti : c'est un client qui attend
  // peut-être un rappel, et personne ne le saurait sans le dire ici.
  const rien =
    leads.length === 0 &&
    taches.length === 0 &&
    rdv === null &&
    sansSuite(appel, { leads: 0, appointments: 0, tasks: 0 });

  const nom =
    appel.contacts?.full_name ??
    appel.contacts?.company_name ??
    formatPhone(appel.from_e164);

  const traitements = [
    processingLabel(appel.transcription_status, "Transcription"),
    processingLabel(appel.summary_status, "Résumé"),
    processingLabel(appel.recording_status, "Enregistrement"),
  ].filter((v): v is string => v !== null);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/app/appels" className="text-sm text-ink-soft underline underline-offset-4">
          ← Tous les appels
        </Link>
      </div>

      <SectionTitle>{nom}</SectionTitle>

      <Sheet className="flex flex-col gap-1">
        <p className="text-sm text-ink-soft first-letter:uppercase">{formatCallMoment(appel.started_at)}</p>
        <p className="text-sm text-ink-soft">
          {formatPhone(appel.from_e164)} · {CALL_STATUS_LABELS[appel.status]} ·{" "}
          {formatDuration(appel.duration_seconds)}
        </p>
        {appel.is_test ? (
          <p className="text-sm text-ink-soft">
            Appel d’essai. Il ne compte dans aucune statistique.
          </p>
        ) : null}
        {appel.contacts ? (
          <Link
            href={`/app/contacts/${appel.contacts.id}`}
            className="mt-1 text-sm font-medium text-signal underline underline-offset-4"
          >
            Voir la fiche du client
          </Link>
        ) : null}
      </Sheet>

      <section>
        <SectionTitle>Écouter l’appel</SectionTitle>
        {appel.recording_path ? (
          <Sheet>
            {/* Le fichier n'est jamais servi par une URL publique : la lecture
                passera par une adresse signée, générée après vérification de
                l'organisation (section 40). */}
            <audio controls preload="none" className="w-full" src={`/api/calls/${appel.id}/audio`}>
              Votre navigateur ne sait pas lire l’audio.
            </audio>
            {appel.recording_expires_at ? (
              <p className="mt-2 text-sm text-ink-soft">
                Conservé jusqu’au {formatDay(appel.recording_expires_at)}.
              </p>
            ) : null}
          </Sheet>
        ) : (
          <Sheet tone="neutral">
            <p className="text-sm text-ink-soft">
              {appel.recording_status === "NOT_APPLICABLE"
                ? "Cet appel n’a pas été enregistré."
                : appel.recording_status === "FAILED"
                  ? "L’enregistrement n’a pas pu être récupéré."
                  : "L’enregistrement est en cours de récupération."}
            </p>
          </Sheet>
        )}
      </section>

      {rien ? (
        <Sheet tone="attention">
          <p className="font-medium">Rien n’est sorti de cet appel</p>
          <p className="mt-1 text-sm text-ink-soft">
            Sophie n’a noté ni demande, ni rendez-vous, ni rappel. Le client a peut-être
            raccroché avant d’expliquer ce qu’il voulait.
          </p>
        </Sheet>
      ) : null}

      <section>
        <SectionTitle>Résumé de Sophie</SectionTitle>
        <Sheet tone={appel.summary_status === "FAILED" ? "attention" : "neutral"}>
          <p className="text-sm text-ink-soft">
            {appel.summary_status === "FAILED"
              ? "Résumé indisponible. La transcription et l’enregistrement, eux, restent accessibles."
              : "Le résumé automatique arrive avec le traitement après appel."}
          </p>
        </Sheet>
      </section>

      {rdv ? (
        <section>
          <SectionTitle>Rendez-vous issu de cet appel</SectionTitle>
          <Sheet tone={rdv.status === "PENDING_APPROVAL" ? "attention" : "neutral"}>
            <p className="font-medium">{rdv.title}</p>
            <p className="text-sm text-ink-soft first-letter:uppercase">
              {formatDay(rdv.starts_at)} · {formatTime(rdv.starts_at)} – {formatTime(rdv.ends_at)}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {APPOINTMENT_STATUS_LABELS[rdv.status]}
            </p>
            <Link
              href="/app/agenda"
              className="mt-2 inline-block text-sm font-medium text-signal underline underline-offset-4"
            >
              Ouvrir l’agenda
            </Link>
          </Sheet>
        </section>
      ) : null}

      {leads.length > 0 ? (
        <section>
          <SectionTitle>Demande enregistrée</SectionTitle>
          <ul className="flex flex-col gap-2">
            {leads.map((lead) => (
              <li key={lead.id}>
                <Link href="/app/prospects" className="block">
                  <Sheet tone={lead.priority === "URGENT" ? "urgent" : "neutral"}>
                    <p className="font-medium">{lead.title}</p>
                    <p className="mt-1 text-sm text-ink-soft">
                      {lead.priority === "URGENT" ? "Urgent · " : ""}
                      {LEAD_STATUS_LABELS[lead.status]}
                    </p>
                  </Sheet>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {taches.length > 0 ? (
        <section>
          <SectionTitle>À faire après cet appel</SectionTitle>
          <ul className="flex flex-col gap-2">
            {taches.map((tache) => (
              <li key={tache.id}>
                <Sheet tone="neutral">
                  <p className="font-medium">{tache.title}</p>
                  {tache.due_at ? (
                    <p className="mt-1 text-sm text-ink-soft first-letter:uppercase">
                      {formatDay(tache.due_at)} · {formatTime(tache.due_at)}
                    </p>
                  ) : null}
                </Sheet>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {traitements.length > 0 ? (
        <Sheet tone="neutral">
          <p className="text-sm text-ink-soft">{traitements.join(" · ")}</p>
        </Sheet>
      ) : null}
    </div>
  );
}
