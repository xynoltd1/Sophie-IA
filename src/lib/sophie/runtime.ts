import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildAnnouncement } from "./announcement";
import {
  composerAccueil,
  modelePourMoment,
  momentDeLaJournee,
  premierMessage,
  type Moment,
} from "./greeting";

/**
 * Ce que Zeli dit en décrochant, pour UNE organisation.
 *
 * ## La règle qui gouverne ce module
 *
 * Si on ne sait pas avec certitude au nom de qui on parlerait, on ne parle
 * pas. Aucun repli sur une organisation par défaut, aucune valeur
 * d'environnement qui servirait de filet. Un filet, ici, ferait décrocher
 * Zeli au nom d'une entreprise qui n'est pas celle qu'on a appelée — c'est
 * exactement la fuite entre clients que toute l'architecture cherche à
 * empêcher.
 *
 * ## Le budget de temps
 *
 * Le fournisseur vocal attend la réponse 7,5 secondes, délai non
 * configurable, au-delà duquel l'appel échoue chez un vrai client. D'où une
 * seule fonction en base (`sophie_runtime_for_number`) qui rend tout, et une
 * annonce légale calculée ensuite seulement si l'enregistrement est actif.
 */

export type RefusAccueil =
  "NUMERO_INCONNU" | "ORGANISATION_SUPPRIMEE" | "SOPHIE_INACTIVE";

export interface AccueilResolu {
  organizationId: string;
  phoneNumberId: string | null;
  isTest: boolean;
  /** L'assistant à utiliser chez le fournisseur, quand le numéro en nomme un. */
  assistantExternalId: string | null;

  entreprise: string;
  assistante: string;
  langue: string;
  voiceId: string | null;
  style: string;
  metier: string | null;
  moment: Moment;

  /** L'accueil commercial seul. */
  accueil: string;
  /** L'annonce légale seule, ou null quand elle n'est pas due. */
  annonce: string | null;
  /** Ce qui sera réellement prononcé en premier : les deux, dans l'ordre réglé. */
  premierMessage: string;
  /** Faux si l'annonce d'enregistrement n'a pas été validée juridiquement. */
  annonceValidee: boolean;
  mentionneEnregistrement: boolean;

  comportement: string | null;
  transfertVers: string | null;
}

interface LigneRuntime {
  organization_id: string;
  phone_number_id: string | null;
  is_test: boolean;
  assistant_external_id: string | null;
  organization_name: string;
  country_code: string;
  locale: string;
  timezone: string;
  organization_active: boolean;
  assistant_name: string;
  spoken_name: string | null;
  language: string;
  voice_id: string | null;
  style: string;
  greeting: string | null;
  greeting_morning: string | null;
  greeting_evening: string | null;
  greeting_closed: string | null;
  notice_position: string;
  behavior_notes: string | null;
  sophie_active: boolean;
  answer_mode: string;
  transfer_number_e164: string | null;
  profession_label: string | null;
}

/**
 * Résout le numéro appelé en accueil prononçable.
 *
 * Rend un refus motivé plutôt que `null` : l'appelant du module doit pouvoir
 * dire pourquoi Zeli ne décroche pas, et les trois raisons n'appellent pas
 * la même réponse au téléphone.
 */
export async function accueilPourNumero(
  numeroAppele: string,
  options: { maintenant?: Date; ouvert?: boolean } = {},
): Promise<
  { ok: true; accueil: AccueilResolu } | { ok: false; refus: RefusAccueil }
> {
  const admin = createAdminClient();

  const { data } = await admin.rpc("sophie_runtime_for_number", {
    numero: numeroAppele,
  });

  const ligne = (Array.isArray(data) ? data[0] : data) as
    LigneRuntime | undefined;

  if (!ligne?.organization_id) return { ok: false, refus: "NUMERO_INCONNU" };
  if (!ligne.organization_active) {
    return { ok: false, refus: "ORGANISATION_SUPPRIMEE" };
  }
  if (!ligne.sophie_active || ligne.answer_mode === "OFF") {
    return { ok: false, refus: "SOPHIE_INACTIVE" };
  }

  const maintenant = options.maintenant ?? new Date();
  const moment = momentDeLaJournee(maintenant, ligne.timezone);

  const entreprise =
    ligne.spoken_name?.trim() || ligne.organization_name.trim();

  const accueil = composerAccueil({
    modele: modelePourMoment({
      base: ligne.greeting,
      matin: ligne.greeting_morning,
      soir: ligne.greeting_evening,
      horsHoraires: ligne.greeting_closed,
      moment,
      ouvert: options.ouvert ?? true,
    }),
    entreprise,
    assistante: ligne.assistant_name,
    metier: ligne.profession_label,
    moment,
  });

  // L'annonce légale est calculée à part. `buildAnnouncement` interroge
  // `recording_allowed()`, qui refuse tant que le texte du pays n'a pas été
  // validé : on ne décide rien ici.
  const annonceComplete = await buildAnnouncement({
    organizationId: ligne.organization_id,
    organizationName: entreprise,
    assistantName: ligne.assistant_name,
    countryCode: ligne.country_code,
    locale: ligne.locale,
    isTest: ligne.is_test,
  });

  // Seule la partie enregistrement nous intéresse : la mention d'IA est déjà
  // dans l'accueil, garantie par `composerAccueil`. La répéter deux fois en
  // deux phrases est exactement le discours robotique qu'on veut éviter.
  const annonce = annonceComplete.mentionsRecording
    ? partieEnregistrement(annonceComplete.text)
    : null;

  const position =
    ligne.notice_position === "AVANT_ACCUEIL"
      ? "AVANT_ACCUEIL"
      : "APRES_ACCUEIL";

  return {
    ok: true,
    accueil: {
      organizationId: ligne.organization_id,
      phoneNumberId: ligne.phone_number_id,
      isTest: ligne.is_test,
      assistantExternalId: ligne.assistant_external_id,
      entreprise,
      assistante: ligne.assistant_name,
      langue: ligne.language,
      voiceId: ligne.voice_id,
      style: ligne.style,
      metier: ligne.profession_label,
      moment,
      accueil,
      annonce,
      premierMessage: premierMessage({ accueil, annonce, position }),
      annonceValidee: annonceComplete.legallyValidated,
      mentionneEnregistrement: annonceComplete.mentionsRecording,
      comportement: ligne.behavior_notes,
      transfertVers: ligne.transfer_number_e164,
    },
  };
}

/**
 * Isole la phrase d'enregistrement de la présentation qui la précède.
 *
 * `buildAnnouncement` rend un texte entier parce qu'il servait de message
 * unique. Ici la présentation est déjà faite par l'accueil ; on ne garde que
 * ce qui porte sur l'enregistrement. Si le découpage échoue, on garde tout :
 * répéter une présentation est maladroit, perdre l'information légale ne
 * l'est pas, c'est une faute.
 */
function partieEnregistrement(texte: string): string {
  const marqueur = texte.search(/Cet appel|Vos échanges|Cette conversation/i);
  if (marqueur > 0) return texte.slice(marqueur).trim();

  const phrases = texte.split(/(?<=\.)\s+/);
  const retenues = phrases.filter((phrase) => /enregistr/i.test(phrase));
  return retenues.length > 0 ? retenues.join(" ").trim() : texte.trim();
}
