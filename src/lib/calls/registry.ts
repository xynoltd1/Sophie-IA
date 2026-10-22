import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { CallRow, CallStatus, NumberOwnerRow, ProcessingStatus } from "@/types/database";

/**
 * Enregistrement des appels.
 *
 * Ce module est le seul endroit où un appel naît et change d'état. Il est
 * appelé par les webhooks du fournisseur de téléphonie, jamais par le
 * navigateur : un appel est un **fait constaté**, pas une affirmation.
 *
 * Deux principes gouvernent tout ce fichier.
 *
 * **L'idempotence.** Un fournisseur rejoue ses webhooks — en cas de timeout, de
 * redéploiement, ou simplement parce que c'est leur politique de réessai. Deux
 * livraisons du même événement doivent produire le même résultat qu'une seule.
 * D'où la contrainte d'unicité sur `(provider, provider_call_id)` et l'usage
 * systématique d'un upsert sur cette clé.
 *
 * **L'appel d'abord, les détails ensuite.** La ligne est créée dès que l'appel
 * sonne, avant de savoir qui appelle, avant la transcription, avant tout. Si la
 * suite échoue, il reste la trace d'un appel reçu — ce qui est déjà l'essentiel
 * pour l'artisan. L'inverse, attendre d'avoir tout pour écrire, perd l'appel
 * entier au premier incident.
 */

/** Ce que l'on sait au moment où un appel commence. */
export interface IncomingCall {
  provider: string;
  providerCallId: string;
  /** Numéro APPELÉ : c'est lui qui désigne l'organisation. */
  toNumber: string;
  /** Numéro de l'appelant, quand il n'est pas masqué. */
  fromNumber?: string | null;
  startedAt?: Date;
}

export interface CallRecord {
  call: CallRow;
  /** Vrai quand cet appel vient d'être créé, faux si l'événement était rejoué. */
  created: boolean;
}

/**
 * Résout le numéro appelé en organisation.
 *
 * Renvoie `null` si le numéro est inconnu ou désactivé. C'est volontaire : un
 * appel attribué à la mauvaise entreprise serait bien pire qu'un appel refusé,
 * parce qu'il exposerait les données d'un artisan à un autre.
 */
export async function ownerOfNumber(numero: string): Promise<NumberOwnerRow | null> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("organization_for_number", { numero });

  const ligne = Array.isArray(data) ? data[0] : data;
  if (!ligne?.organization_id) return null;

  return ligne as NumberOwnerRow;
}

/**
 * Ouvre un appel, ou retrouve celui qui existe déjà.
 *
 * Ne lève pas quand le numéro est inconnu : renvoie `null`. L'appelant décide
 * quoi faire — en général, laisser le fournisseur jouer un message et
 * raccrocher, plutôt que de faire parler Sophie au nom de personne.
 */
export async function openCall(incoming: IncomingCall): Promise<CallRecord | null> {
  const proprietaire = await ownerOfNumber(incoming.toNumber);
  if (!proprietaire) return null;

  const admin = createAdminClient();

  // On lit d'abord : si l'appel existe, l'événement est un rejeu et il ne faut
  // surtout pas écraser un état plus avancé (un appel déjà terminé, par
  // exemple) avec l'état « ça sonne ».
  const { data: existant } = await admin
    .from("calls")
    .select("*")
    .eq("provider", incoming.provider)
    .eq("provider_call_id", incoming.providerCallId)
    .maybeSingle();

  if (existant) return { call: existant as CallRow, created: false };

  const { data, error } = await admin
    .from("calls")
    .insert({
      organization_id: proprietaire.organization_id,
      phone_number_id: proprietaire.phone_number_id,
      provider: incoming.provider,
      provider_call_id: incoming.providerCallId,
      direction: "INBOUND",
      from_e164: incoming.fromNumber ?? null,
      to_e164: incoming.toNumber,
      status: "RINGING",
      // ADR-019 : le caractère d'essai vient du NUMÉRO appelé, pas de ce que
      // le fournisseur annonce. Un numéro d'essai ne peut pas produire de
      // vraies statistiques, et un numéro réel ne peut pas être déguisé en test.
      is_test: proprietaire.is_test,
      started_at: (incoming.startedAt ?? new Date()).toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    // Course entre deux livraisons simultanées du même événement : la
    // contrainte d'unicité a fait son travail. On relit plutôt que d'échouer.
    const { data: concurrent } = await admin
      .from("calls")
      .select("*")
      .eq("provider", incoming.provider)
      .eq("provider_call_id", incoming.providerCallId)
      .maybeSingle();

    if (concurrent) return { call: concurrent as CallRow, created: false };
    throw new Error(`Appel non enregistré : ${error.message}`);
  }

  return { call: data as CallRow, created: true };
}

/**
 * Transitions autorisées.
 *
 * Un fournisseur peut livrer ses événements dans le désordre. Sans cette table,
 * un « ça sonne » arrivé en retard repasserait un appel terminé à `RINGING`, et
 * l'artisan verrait un appel en cours qui n'existe plus.
 */
const TRANSITIONS: Record<CallStatus, readonly CallStatus[]> = {
  RINGING: ["ANSWERED", "MISSED", "FAILED", "TRANSFERRED", "COMPLETED"],
  ANSWERED: ["COMPLETED", "TRANSFERRED", "FAILED"],
  // États terminaux : plus rien ne les modifie.
  COMPLETED: [],
  MISSED: [],
  FAILED: [],
  TRANSFERRED: ["COMPLETED"],
};

export function transitionAllowed(from: CallStatus, to: CallStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

export interface CallClosure {
  status: CallStatus;
  endedAt?: Date;
  durationSeconds?: number | null;
  endedReason?: string | null;
  answeredAt?: Date | null;
}

/**
 * Fait avancer l'état d'un appel.
 *
 * Renvoie `null` quand la transition est refusée — ce n'est pas une erreur,
 * c'est un événement arrivé trop tard, et le silence est la bonne réponse.
 */
export async function closeCall(
  callId: string,
  closure: CallClosure,
): Promise<CallRow | null> {
  const admin = createAdminClient();

  const { data: actuel } = await admin
    .from("calls")
    .select("id, status")
    .eq("id", callId)
    .maybeSingle();

  if (!actuel) return null;
  if (!transitionAllowed(actuel.status as CallStatus, closure.status)) return null;

  const terminal = ["COMPLETED", "MISSED", "FAILED", "TRANSFERRED"].includes(closure.status);

  const { data } = await admin
    .from("calls")
    .update({
      status: closure.status,
      // La contrainte `calls_terminal_has_end` exige une fin pour tout état
      // terminal. On la respecte ici plutôt que de laisser la base refuser.
      ended_at: terminal ? (closure.endedAt ?? new Date()).toISOString() : null,
      answered_at: closure.answeredAt ? closure.answeredAt.toISOString() : undefined,
      duration_seconds: closure.durationSeconds ?? null,
      ended_reason: closure.endedReason ?? null,
    })
    .eq("id", callId)
    .select("*")
    .maybeSingle();

  return (data as CallRow | null) ?? null;
}

/**
 * Programme les traitements post-appel.
 *
 * Séparé de la fermeture de l'appel à dessein : on ne veut pas qu'une erreur de
 * programmation des traitements empêche l'appel d'être marqué terminé.
 */
export async function schedulePostCall(
  callId: string,
  plan: {
    recording?: ProcessingStatus;
    transcription?: ProcessingStatus;
    summary?: ProcessingStatus;
  },
): Promise<void> {
  const admin = createAdminClient();

  const champs: Record<string, ProcessingStatus> = {};
  if (plan.recording) champs.recording_status = plan.recording;
  if (plan.transcription) champs.transcription_status = plan.transcription;
  if (plan.summary) champs.summary_status = plan.summary;

  if (Object.keys(champs).length === 0) return;

  await admin.from("calls").update(champs).eq("id", callId);
}
