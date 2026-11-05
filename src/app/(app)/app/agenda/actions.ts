"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  pushAppointment,
  removeAppointment,
} from "@/lib/providers/calendar/service";
import { signalerErreurFournisseur } from "@/lib/platform/errors";
import { instantDepuisHeureLocale } from "@/lib/crm/timezone";
import type { AppointmentStatus } from "@/types/database";
import { noterEchangeReussi } from "@/lib/platform/errors";

export interface AgendaState {
  error?: string;
  success?: string;
}

const bookSchema = z.object({
  title: z.string().trim().min(2, "Donnez un intitulé au rendez-vous").max(200),
  startsAt: z.string().min(10, "Choisissez un créneau"),
  durationMinutes: z.coerce.number().int().min(5).max(1440),
  contactId: z.string().uuid().optional().or(z.literal("")),
  leadId: z.string().uuid().optional().or(z.literal("")),
});

/**
 * Réserve un créneau.
 *
 * La vérification de disponibilité n'est pas faite ici : elle est faite par la
 * contrainte d'exclusion en base. Vérifier côté application laisserait une
 * fenêtre entre le contrôle et l'insertion, que deux réservations simultanées
 * traverseraient. On tente, et on traduit le refus.
 */
export async function bookAppointment(
  _prev: AgendaState,
  formData: FormData,
): Promise<AgendaState> {
  const parsed = bookSchema.safeParse({
    title: formData.get("title"),
    startsAt: formData.get("startsAt"),
    durationMinutes: formData.get("durationMinutes"),
    contactId: formData.get("contactId") ?? "",
    leadId: formData.get("leadId") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const debut = new Date(parsed.data.startsAt);
  const fin = new Date(debut.getTime() + parsed.data.durationMinutes * 60_000);

  const { error } = await supabase.rpc("book_appointment", {
    org_id: activeOrganization.organization_id,
    titre: parsed.data.title,
    debut: debut.toISOString(),
    fin: fin.toISOString(),
    contact: parsed.data.contactId || null,
    lead: parsed.data.leadId || null,
    service: null,
    intervenant: null,
    statut: "CONFIRMED",
    duree_hold: null,
  });

  if (error) {
    // 23505 : la contrainte d'exclusion a refusé. Quelqu'un a réservé entre-temps.
    if (error.code === "23505" || error.message.includes("vient d etre pris")) {
      return { error: "Ce créneau vient d’être pris. Choisissez-en un autre." };
    }
    return { error: "Le rendez-vous n’a pas pu être créé. Réessayez." };
  }

  revalidatePath("/app/agenda");
  revalidatePath("/app");
  return { success: "Rendez-vous enregistré." };
}

/**
 * Change l'état d'un rendez-vous, et synchronise l'agenda externe.
 *
 * Ordre volontaire (section 22) : la base d'abord, l'agenda ensuite. La
 * contrainte d'exclusion revérifie la disponibilité au moment du changement —
 * c'est elle qui empêche deux confirmations concurrentes, pas une vérification
 * applicative.
 *
 * Si l'écriture vers Google échoue, le rendez-vous RESTE confirmé chez nous et
 * l'écart est enregistré. On ne prétend pas que tout est en ordre, et on
 * n'annule pas un rendez-vous réel à cause d'une panne d'agenda.
 */
export async function changeAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
): Promise<{ error?: string; warning?: string }> {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();
  const orgId = activeOrganization.organization_id;

  const { error } = await supabase.rpc("set_appointment_status", {
    rdv_id: appointmentId,
    statut: status,
    motif: null,
  });

  if (error) {
    if (error.code === "23505" || error.message.includes("deja occupe")) {
      return {
        error: "Ce créneau est déjà occupé. Proposez un autre horaire.",
      };
    }
    return { error: "Le rendez-vous n'a pas pu être mis à jour." };
  }

  let warning: string | undefined;

  try {
    if (status === "CONFIRMED") {
      const pousse = await pushAppointment({
        organizationId: orgId,
        appointmentId,
      });
      if (pousse) {
        await noterEchangeReussi("GOOGLE_CALENDAR", "pushAppointment");
        await supabase
          .from("appointments")
          .update({
            external_synced_at: new Date().toISOString(),
            external_sync_error: null,
          })
          .eq("id", appointmentId)
          .eq("organization_id", orgId);
      }
    } else if (status === "CANCELLED" || status === "REJECTED") {
      await removeAppointment({ organizationId: orgId, appointmentId });
    }
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "L'agenda externe n'a pas pu être mis à jour.";

    await supabase
      .from("appointments")
      .update({ external_sync_error: message })
      .eq("id", appointmentId)
      .eq("organization_id", orgId);

    // Le professionnel voit un avertissement sur sa fiche ; l'exploitation a
    // besoin de voir la panne elle-même, agrégée sur toutes les entreprises.
    // Sans ce second journal, dix échecs Google ressemblent à dix accidents.
    await signalerErreurFournisseur({
      provider: "GOOGLE_CALENDAR",
      operation:
        status === "CONFIRMED" ? "pushAppointment" : "removeAppointment",
      message,
      organizationId: orgId,
      correlationId: appointmentId,
    });

    warning =
      "Le rendez-vous est enregistré, mais il n'a pas pu être écrit dans votre agenda Google. Ajoutez-le à la main ou réessayez.";
  }

  revalidatePath("/app/agenda");
  revalidatePath("/app");
  return warning ? { warning } : {};
}

/** Nouvelle tentative d'écriture vers l'agenda externe, après un échec. */
export async function retryCalendarSync(
  appointmentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();
  const orgId = activeOrganization.organization_id;

  try {
    await pushAppointment({ organizationId: orgId, appointmentId });
    await supabase
      .from("appointments")
      .update({
        external_synced_at: new Date().toISOString(),
        external_sync_error: null,
      })
      .eq("id", appointmentId)
      .eq("organization_id", orgId);

    revalidatePath("/app/agenda");
    return { ok: true };
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "L'agenda externe reste injoignable.";

    await signalerErreurFournisseur({
      provider: "GOOGLE_CALENDAR",
      operation: "retryCalendarSync",
      message,
      organizationId: orgId,
      correlationId: appointmentId,
    });

    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Workflow complet du rendez-vous (Phase 6, sections 22 à 26)
// ---------------------------------------------------------------------------

/**
 * Ce qu'un rendez-vous a besoin de savoir pour prévenir le client.
 *
 * Lu par le client de session, donc à travers RLS : un rendez-vous d'une autre
 * entreprise ne remonte pas, même si l'identifiant est deviné.
 */
async function contexteRendezVous(appointmentId: string, orgId: string) {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("appointments")
    .select(
      "id, title, starts_at, ends_at, status, contact_id, contacts(full_name, phone_e164)",
    )
    .eq("id", appointmentId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!data) return null;

  const contact = (
    data as unknown as { contacts: { phone_e164: string | null } | null }
  ).contacts;

  return {
    id: data.id as string,
    title: data.title as string,
    startsAt: data.starts_at as string,
    endsAt: data.ends_at as string,
    status: data.status as AppointmentStatus,
    contactId: data.contact_id as string | null,
    telephone: contact?.phone_e164 ?? null,
  };
}

async function nomEtFuseau(
  orgId: string,
): Promise<{ nom: string; timezone: string }> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("organizations")
    .select("name, timezone")
    .eq("id", orgId)
    .maybeSingle();

  return {
    nom: (data?.name as string | undefined) ?? "Votre artisan",
    timezone: (data?.timezone as string | undefined) ?? "Europe/Brussels",
  };
}

export interface ResultatDecision {
  error?: string;
  warning?: string;
  success?: string;
  /** Vrai quand le message est en file mais n'est pas parti faute d'opérateur. */
  smsEnAttente?: boolean;
}

/**
 * Refuser un rendez-vous, avec un motif et un message au client (section 24).
 *
 * L'ordre compte. On change l'état d'abord : c'est la seule chose qui ne doit
 * pas pouvoir être perdue. Le message part ensuite, et son échec n'annule rien.
 */
export async function refuserRendezVous(
  appointmentId: string,
  options: { motif?: string; prevenirClient?: boolean } = {},
): Promise<ResultatDecision> {
  return deciderEtPrevenir(appointmentId, {
    statut: "REJECTED",
    motif: options.motif,
    modele: "APPOINTMENT_REJECTED",
    prevenir: options.prevenirClient !== false,
    succes: "Rendez-vous refusé.",
  });
}

/** Annuler un rendez-vous confirmé (section 25). */
export async function annulerRendezVous(
  appointmentId: string,
  options: { motif?: string; prevenirClient?: boolean } = {},
): Promise<ResultatDecision> {
  return deciderEtPrevenir(appointmentId, {
    statut: "CANCELLED",
    motif: options.motif,
    modele: "APPOINTMENT_CANCELLED",
    prevenir: options.prevenirClient !== false,
    succes: "Rendez-vous annulé.",
  });
}

/** Accepter un rendez-vous provisoire, et le dire au client (section 22). */
export async function confirmerRendezVous(
  appointmentId: string,
  options: { prevenirClient?: boolean } = {},
): Promise<ResultatDecision> {
  return deciderEtPrevenir(appointmentId, {
    statut: "CONFIRMED",
    modele: "APPOINTMENT_CONFIRMED",
    prevenir: options.prevenirClient !== false,
    succes: "Rendez-vous confirmé.",
  });
}

async function deciderEtPrevenir(
  appointmentId: string,
  params: {
    statut: AppointmentStatus;
    modele:
      | "APPOINTMENT_CONFIRMED"
      | "APPOINTMENT_REJECTED"
      | "APPOINTMENT_CANCELLED";
    motif?: string;
    prevenir: boolean;
    succes: string;
  },
): Promise<ResultatDecision> {
  const { activeOrganization } = await requireOrganization();
  const orgId = activeOrganization.organization_id;

  const rdv = await contexteRendezVous(appointmentId, orgId);
  if (!rdv) return { error: "Rendez-vous introuvable." };

  const changement = await changeAppointmentStatus(
    appointmentId,
    params.statut,
  );
  if (changement.error) return { error: changement.error };

  if (params.motif?.trim()) {
    const supabase = await createServerSupabase();
    await supabase
      .from("appointments")
      .update({ decision_reason: params.motif.trim().slice(0, 500) })
      .eq("id", appointmentId)
      .eq("organization_id", orgId);
  }

  let smsEnAttente = false;

  if (params.prevenir && rdv.telephone) {
    const { nom, timezone } = await nomEtFuseau(orgId);
    const { construireMessage, quandLisible } =
      await import("@/lib/messaging/templates");
    const { envoyerMessage } = await import("@/lib/messaging/outbox");

    const envoi = await envoyerMessage({
      organizationId: orgId,
      to: rdv.telephone,
      kind: params.modele,
      body: construireMessage(params.modele, {
        entreprise: nom,
        quand: quandLisible(rdv.startsAt, timezone),
        motif: params.motif,
      }),
      // La clé lie le message À CETTE décision : confirmer puis annuler envoie
      // bien deux messages, mais confirmer deux fois n'en envoie qu'un.
      idempotencyKey: `${params.modele}:${appointmentId}`,
      contactId: rdv.contactId,
      appointmentId,
    });

    smsEnAttente = !envoi.envoye;
  }

  revalidatePath("/app/agenda");
  revalidatePath("/app");

  return {
    success: params.succes,
    warning: changement.warning,
    smsEnAttente,
  };
}

/**
 * Proposer un autre horaire (section 23).
 *
 * Le rendez-vous ne devient PAS confirmé : il passe en attente de la réponse
 * du client, qui répond par un lien. Confirmer unilatéralement un horaire que
 * le client n'a pas accepté produirait un rendez-vous où personne n'ouvre la
 * porte.
 *
 * Le créneau d'origine reste bloqué tant que le client n'a pas répondu : le
 * libérer exposerait à le perdre pendant la négociation.
 */
export async function proposerAutreHoraire(
  appointmentId: string,
  nouveauDebut: string,
  dureeMinutes: number,
  options: { prevenirClient?: boolean } = {},
): Promise<ResultatDecision> {
  const { activeOrganization } = await requireOrganization();
  const orgId = activeOrganization.organization_id;
  const supabase = await createServerSupabase();

  const rdv = await contexteRendezVous(appointmentId, orgId);
  if (!rdv) return { error: "Rendez-vous introuvable." };

  // `datetime-local` rend « 2026-11-04T09:00 », sans fuseau. `new Date()` le
  // lirait dans le fuseau de la MACHINE, qui est en temps universel sur
  // l'hébergeur : le rendez-vous se décalerait d'une à deux heures selon la
  // saison. C'est la faute corrigée par l'ADR-029, et elle guette partout où
  // une heure saisie par un humain devient un instant.
  const entreprise = await nomEtFuseau(orgId);
  const fuseau = entreprise.timezone;
  const [jour, heure] = nouveauDebut.split("T");
  const debut =
    jour && heure
      ? instantDepuisHeureLocale(jour, heure.slice(0, 5), fuseau)
      : null;

  if (!debut) return { error: "Horaire invalide." };
  if (debut.getTime() < Date.now())
    return { error: "Cet horaire est déjà passé." };

  const duree = Math.min(Math.max(Math.round(dureeMinutes), 5), 1440);
  const fin = new Date(debut.getTime() + duree * 60_000);

  // Jeton imprévisible : c'est la seule chose qui protège la page de réponse.
  const jeton =
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "");

  const { error } = await supabase
    .from("appointments")
    .update({
      status: "CHANGE_PROPOSED",
      proposed_starts_at: debut.toISOString(),
      proposed_ends_at: fin.toISOString(),
      proposal_token: jeton,
      // Sept jours : au-delà, un lien qui traîne dans un historique de SMS ne
      // doit plus pouvoir déplacer un rendez-vous.
      proposal_expires_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })
    .eq("id", appointmentId)
    .eq("organization_id", orgId);

  if (error) return { error: "La proposition n'a pas pu être enregistrée." };

  let smsEnAttente = false;

  if (options.prevenirClient !== false && rdv.telephone) {
    const nom = entreprise.nom;
    const timezone = fuseau;
    const { construireMessage, quandLisible } =
      await import("@/lib/messaging/templates");
    const { envoyerMessage } = await import("@/lib/messaging/outbox");

    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

    const envoi = await envoyerMessage({
      organizationId: orgId,
      to: rdv.telephone,
      kind: "APPOINTMENT_CHANGE_PROPOSED",
      body: construireMessage("APPOINTMENT_CHANGE_PROPOSED", {
        entreprise: nom,
        quand: quandLisible(debut.toISOString(), timezone),
        lien: `${base}/rdv/${jeton}`,
      }),
      // Le jeton entre dans la clé : une nouvelle proposition est un nouveau
      // message, même pour le même rendez-vous.
      idempotencyKey: `APPOINTMENT_CHANGE_PROPOSED:${appointmentId}:${jeton.slice(0, 12)}`,
      contactId: rdv.contactId,
      appointmentId,
    });

    smsEnAttente = !envoi.envoye;
  }

  revalidatePath("/app/agenda");
  revalidatePath("/app");

  return { success: "Nouvel horaire proposé au client.", smsEnAttente };
}

/** Nouvelle tentative d'envoi d'un message resté en file (section 26). */
export async function reessayerMessage(
  messageId: string,
): Promise<{ ok: boolean; erreur?: string }> {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  // Lecture par RLS : un message d'une autre entreprise n'existe pas ici.
  const { data } = await supabase
    .from("outbound_messages")
    .select("id")
    .eq("id", messageId)
    .eq("organization_id", activeOrganization.organization_id)
    .maybeSingle();

  if (!data) return { ok: false, erreur: "Message introuvable." };

  const { expedier } = await import("@/lib/messaging/outbox");
  const resultat = await expedier(messageId);

  revalidatePath("/app/agenda");
  return { ok: resultat.envoye, erreur: resultat.erreur };
}
