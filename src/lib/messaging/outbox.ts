import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { messagingProvider } from "@/lib/providers/messaging";
import type { ModeleMessage } from "./templates";

/**
 * La file des messages sortants.
 *
 * Mettre en file d'abord, envoyer ensuite. Cet ordre est le cœur du dispositif :
 * si l'envoi échoue — opérateur injoignable, compte absent, numéro refusé — le
 * message existe toujours, l'écran peut dire « SMS non envoyé — Réessayer », et
 * le travail planifié peut reprendre (section 26).
 *
 * Ce qu'on ne fait jamais : défaire un rendez-vous parce qu'un SMS n'est pas
 * parti. Le rendez-vous est la réalité, le SMS n'en est que l'annonce.
 */

export const PLAFOND_ENVOIS = 3;

export interface DemandeMessage {
  organizationId: string;
  to: string;
  body: string;
  kind: ModeleMessage | "CUSTOM";
  idempotencyKey: string;
  contactId?: string | null;
  appointmentId?: string | null;
  createdBy?: string | null;
}

export interface ResultatFile {
  messageId: string | null;
  envoye: boolean;
  erreur?: string;
  /** Vrai quand aucun opérateur n'est configuré : le message attend. */
  simule: boolean;
}

/**
 * Met un message en file, puis tente de l'envoyer tout de suite.
 *
 * L'envoi immédiat est voulu : un client qui reçoit sa confirmation deux
 * heures plus tard a déjà rappelé. Si l'envoi échoue, la file prend le relais.
 */
export async function envoyerMessage(
  demande: DemandeMessage,
): Promise<ResultatFile> {
  const admin = createAdminClient();

  // `upsert` sur la clé d'idempotence : deux clics sur le même bouton ne
  // créent qu'un message. Sans cela, le client reçoit deux SMS identiques, ce
  // qui coûte deux fois et fait désordre.
  const { data: existant } = await admin
    .from("outbound_messages")
    .select("id, status")
    .eq("organization_id", demande.organizationId)
    .eq("idempotency_key", demande.idempotencyKey)
    .maybeSingle();

  if (existant && ["SENT", "DELIVERED"].includes(existant.status as string)) {
    return { messageId: existant.id as string, envoye: true, simule: false };
  }

  let messageId = (existant?.id as string | undefined) ?? null;

  if (!messageId) {
    const { data, error } = await admin
      .from("outbound_messages")
      .insert({
        organization_id: demande.organizationId,
        contact_id: demande.contactId ?? null,
        appointment_id: demande.appointmentId ?? null,
        channel: "SMS",
        kind: demande.kind,
        to_e164: demande.to,
        body: demande.body,
        status: "QUEUED",
        idempotency_key: demande.idempotencyKey,
        created_by: demande.createdBy ?? null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[messagerie] mise en file impossible", error?.message);
      return {
        messageId: null,
        envoye: false,
        erreur: "Le message n'a pas pu être enregistré.",
        simule: false,
      };
    }
    messageId = data.id as string;
  }

  return expedier(messageId);
}

/** Tente l'envoi d'un message déjà en file. Utilisé aussi par « Réessayer ». */
export async function expedier(messageId: string): Promise<ResultatFile> {
  const admin = createAdminClient();

  const { data: message } = await admin
    .from("outbound_messages")
    .select("id, to_e164, body, attempts, idempotency_key, status")
    .eq("id", messageId)
    .maybeSingle();

  if (!message) {
    return {
      messageId,
      envoye: false,
      erreur: "Message introuvable.",
      simule: false,
    };
  }

  if (["SENT", "DELIVERED"].includes(message.status as string)) {
    return { messageId, envoye: true, simule: false };
  }

  const fournisseur = messagingProvider();

  await admin
    .from("outbound_messages")
    .update({ status: "SENDING" })
    .eq("id", messageId);

  const resultat = await fournisseur.send({
    to: message.to_e164 as string,
    body: message.body as string,
    channel: "SMS",
    idempotencyKey: message.idempotency_key as string,
  });

  const reussi = resultat.status === "SENT" || resultat.status === "DELIVERED";

  await admin
    .from("outbound_messages")
    .update({
      status: resultat.status,
      attempts: (message.attempts as number) + 1,
      last_error: resultat.error ?? null,
      provider: fournisseur.name,
      provider_message_id: resultat.providerMessageId ?? null,
      sent_at: reussi ? new Date().toISOString() : null,
    })
    .eq("id", messageId);

  if (reussi) {
    await refleterDansLeFil(messageId);

    const { enregistrerUsage } = await import("@/lib/platform/usage");
    const { data: orgRow } = await admin
      .from("outbound_messages")
      .select("organization_id")
      .eq("id", messageId)
      .maybeSingle();

    if (orgRow?.organization_id) {
      await enregistrerUsage({
        organizationId: orgRow.organization_id as string,
        kind: "SMS_SENT",
        quantity: 1,
        messageId,
        dedupeKey: `message:${messageId}`,
      });
    }
  }

  if (!reussi && resultat.error) {
    const { signalerErreurFournisseur } = await import("@/lib/platform/errors");

    // Sans l'organisation, le journal dit « des SMS échouent » sans dire chez
    // qui. On relit la ligne plutôt que de la deviner : un message peut avoir
    // été créé par un autre chemin que celui-ci.
    const { data: ligne } = await admin
      .from("outbound_messages")
      .select("organization_id")
      .eq("id", messageId)
      .maybeSingle();

    await signalerErreurFournisseur({
      provider: fournisseur.name,
      operation: "send_sms",
      message: resultat.error,
      organizationId: (ligne?.organization_id as string | undefined) ?? null,
      correlationId: messageId,
    });
  }

  return {
    messageId,
    envoye: reussi,
    erreur: resultat.error,
    simule: fournisseur.isMock,
  };
}

/** Reprise des messages en attente, appelée par le travail planifié. */
export async function viderLaFile(
  limite = 25,
): Promise<{ envoyes: number; echoues: number }> {
  const admin = createAdminClient();
  const compte = { envoyes: 0, echoues: 0 };

  const { data } = await admin.rpc("messages_to_send", {
    plafond_tentatives: PLAFOND_ENVOIS,
    limite,
  });

  for (const ligne of (data ?? []) as { message_id: string }[]) {
    const resultat = await expedier(ligne.message_id);
    if (resultat.envoye) compte.envoyes += 1;
    else compte.echoues += 1;
  }

  return compte;
}

/**
 * Recopie un message parti dans le fil de conversation du contact.
 *
 * Le message sortant garde sa table — elle porte les tentatives, les erreurs,
 * l'accusé de réception. Le fil, lui, sert à LIRE l'histoire d'un client :
 * appel, SMS, rendez-vous, dans l'ordre. Deux besoins, deux tables, un lien.
 *
 * Ne lève jamais : un fil incomplet est un désagrément, un SMS perdu est une
 * faute.
 */
async function refleterDansLeFil(messageId: string): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: message } = await admin
      .from("outbound_messages")
      .select("id, organization_id, contact_id, body, channel")
      .eq("id", messageId)
      .maybeSingle();

    if (!message?.contact_id) return;

    const canal =
      (message.channel as string) === "SMS"
        ? "SMS"
        : (message.channel as string);

    const { data: fil } = await admin
      .from("conversations")
      .select("id")
      .eq("organization_id", message.organization_id as string)
      .eq("contact_id", message.contact_id as string)
      .eq("channel", canal)
      .eq("is_open", true)
      .maybeSingle();

    let conversationId = fil?.id as string | undefined;

    if (!conversationId) {
      const { data: cree } = await admin
        .from("conversations")
        .insert({
          organization_id: message.organization_id as string,
          contact_id: message.contact_id as string,
          channel: canal,
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      conversationId = cree?.id as string | undefined;
    } else {
      await admin
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    if (!conversationId) return;

    await admin.from("conversation_messages").insert({
      organization_id: message.organization_id as string,
      conversation_id: conversationId,
      direction: "OUTBOUND",
      channel: canal,
      body: message.body as string,
      outbound_message_id: messageId,
    });
  } catch {
    /* le fil n'arbitre rien */
  }
}
