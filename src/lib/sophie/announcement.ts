import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * L'annonce prononcée au début de chaque appel.
 *
 * Elle porte trois choses, et les trois sont obligatoires pour des raisons
 * différentes. Les séparer serait plus propre conceptuellement, mais un
 * appelant n'écoute pas trois annonces : il raccroche.
 *
 * **1. C'est une IA.** Article 50 du règlement (UE) 2024/1689, applicable
 * depuis le 2 août 2026, sanctions jusqu'à 15 M€ ou 3 % du chiffre d'affaires
 * mondial. « Je suis Sophie, l'assistante de M. Dupont » NE SUFFIT PAS : une
 * assistante peut être humaine. Il faut que la nature automatisée soit claire.
 * Cette partie n'est jamais désactivable, et la base le verrouille
 * (migration 0019).
 *
 * **2. L'appel est enregistré**, quand il l'est — et seulement quand il l'est.
 * Annoncer un enregistrement qui n'a pas lieu est aussi faux que l'inverse.
 *
 * **3. Comment s'y opposer.** Le droit français impose que l'appelant puisse
 * s'opposer avant la fin de l'appel. Une annonce qui informe sans ouvrir de
 * porte ne remplit qu'une moitié de l'obligation.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne décide pas si l'enregistrement est permis. C'est `recording_allowed()`
 * en base qui tranche, et elle refuse tant que l'annonce applicable au pays
 * n'a pas été validée juridiquement. Ce module construit le texte ; il ne
 * s'autorise rien.
 */

export interface Announcement {
  /** Texte à prononcer en premier, avant toute autre parole. */
  text: string;
  /** Vrai si l'annonce mentionne un enregistrement réellement actif. */
  mentionsRecording: boolean;
  /**
   * Faux tant que le texte applicable n'a pas été validé par un juriste pour
   * le pays concerné. Un appel RÉEL ne doit pas partir dans cet état.
   */
  legallyValidated: boolean;
}

/** Partie non négociable. Aucun réglage client ne la retire. */
const AI_DISCLOSURE =
  "Vous parlez à un assistant virtuel, un système automatisé.";

/**
 * Repli utilisé quand aucun modèle n'existe en base pour le pays.
 *
 * Il est volontairement complet plutôt que minimal : si quelque chose doit
 * manquer un jour, mieux vaut que ce soit du confort que de l'obligation.
 */
const FALLBACK_RECORDING_NOTICE =
  "Cet appel est enregistré afin de traiter votre demande. " +
  "Vous pouvez vous y opposer ou demander à parler directement à un membre de l'équipe.";

export async function buildAnnouncement(params: {
  organizationId: string;
  organizationName: string;
  assistantName: string;
  countryCode?: string | null;
  locale?: string;
  isTest?: boolean;
}): Promise<Announcement> {
  const admin = createAdminClient();

  const { data: autorise } = await admin.rpc("recording_allowed", {
    org_id: params.organizationId,
    is_test: params.isTest ?? false,
  });

  const enregistre = Boolean(autorise);

  const presentation =
    `Bonjour, ici ${params.assistantName}, pour ${params.organizationName}. ${AI_DISCLOSURE}`;

  if (!enregistre) {
    // Pas d'enregistrement : on ne prétend pas le contraire, et l'obligation
    // de transparence sur l'IA reste due.
    return { text: presentation, mentionsRecording: false, legallyValidated: true };
  }

  const modele = await noticeTemplate(params.countryCode ?? null, params.locale ?? "fr");

  const corps = (modele?.body ?? FALLBACK_RECORDING_NOTICE).replace(
    /\{\{organization\}\}/g,
    params.organizationName,
  );

  return {
    text: `${presentation} ${corps}`,
    mentionsRecording: true,
    legallyValidated: Boolean(modele?.is_legally_validated),
  };
}

/**
 * Cherche le modèle du pays, puis le modèle universel.
 *
 * L'ordre compte : la Belgique et la France n'ont pas le même régime, et
 * servir un texte français à un appelant belge serait une erreur de fond, pas
 * de traduction.
 */
async function noticeTemplate(
  countryCode: string | null,
  locale: string,
): Promise<{ body: string; is_legally_validated: boolean } | null> {
  const admin = createAdminClient();

  if (countryCode) {
    const { data } = await admin
      .from("recording_notice_templates")
      .select("body, is_legally_validated")
      .eq("country_code", countryCode)
      .eq("locale", locale)
      .eq("is_active", true)
      .maybeSingle();

    if (data) return data as { body: string; is_legally_validated: boolean };
  }

  const { data } = await admin
    .from("recording_notice_templates")
    .select("body, is_legally_validated")
    .is("country_code", null)
    .eq("locale", locale)
    .eq("is_active", true)
    .maybeSingle();

  return (data as { body: string; is_legally_validated: boolean } | null) ?? null;
}

/**
 * Vérifie qu'un texte d'annonce dit bien qu'il s'agit d'une IA.
 *
 * Utilisé avant d'envoyer la configuration au fournisseur de voix. Le modèle
 * reformule volontiers ce qu'on lui demande de dire ; cette vérification porte
 * sur le texte que NOUS imposons, pas sur ce que le modèle improvisera.
 */
export function disclosesAI(text: string): boolean {
  const normalise = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  const marqueurs = [
    "assistant virtuel",
    "assistante virtuelle",
    "systeme automatise",
    "intelligence artificielle",
    "repondeur automatique",
  ];

  return marqueurs.some((marqueur) => normalise.includes(marqueur));
}
