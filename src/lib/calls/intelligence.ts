import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { aiProvider } from "@/lib/providers/ai";
import {
  PROMPT_DONNEES,
  PROMPT_RESUME,
  SCHEMA_DONNEES,
} from "@/lib/sophie/analysis";
import { signalerErreurFournisseur } from "@/lib/platform/errors";
import { noterEchangeReussi } from "@/lib/platform/errors";

/**
 * Production du résumé et des champs structurés à partir de la transcription.
 *
 * Trois principes, hérités de ce que la Phase 5 a coûté.
 *
 * **La transcription est la source, et elle est déjà chez nous.** Rien n'est
 * redemandé au fournisseur de voix : son rapport peut avoir expiré, et son
 * analyse ne fonctionne pas. On relit `call_transcript_segments`.
 *
 * **Résumé et extraction échouent séparément.** Un résumé obtenu et une
 * extraction ratée valent mieux que rien du tout. L'inverse aussi.
 *
 * **Chaque échec laisse une trace lisible.** `summary_error` contient une
 * phrase compréhensible, affichée telle quelle au professionnel avec un bouton
 * pour réessayer (section 16).
 */

/** Au-delà, la reprise automatique s'arrête. La relance manuelle reste possible. */
export const PLAFOND_TENTATIVES = 3;

export interface ResultatIntelligence {
  ok: boolean;
  resume: string | null;
  donnees: Record<string, unknown> | null;
  erreur?: string;
  /** Vrai quand le texte vient d'une simulation et non d'un vrai fournisseur. */
  simule: boolean;
}

interface Tour {
  speaker: string;
  content: string;
}

/**
 * La conversation telle qu'un modèle doit la lire.
 *
 * Les noms sont neutres — « Sophie » et « Client » — parce que le nom réel de
 * l'appelant fait partie de ce que l'extraction doit TROUVER. Le lui donner
 * d'avance reviendrait à lui souffler la réponse, et à le laisser confirmer un
 * nom que la transcription a peut-être mal entendu.
 */
export function transcriptionEnTexte(tours: Tour[]): string {
  return tours
    .map((tour) => {
      const qui =
        tour.speaker === "SOPHIE"
          ? "Sophie"
          : tour.speaker === "CLIENT"
            ? "Client"
            : "Système";
      return `${qui} : ${tour.content}`;
    })
    .join("\n");
}

/**
 * Produit le résumé et l'extraction d'un appel, et les enregistre.
 *
 * Idempotent : un appel déjà résumé n'est pas retraité, sauf demande explicite
 * de relance. Les webhooks sont rejoués, et refaire le travail coûterait de
 * l'argent à chaque livraison.
 */
export async function genererIntelligenceAppel(
  callId: string,
  options: { force?: boolean } = {},
): Promise<ResultatIntelligence> {
  const admin = createAdminClient();

  const { data: appel, error: lecture } = await admin
    .from("calls")
    .select("id, organization_id, summary_status, summary_attempts")
    .eq("id", callId)
    .maybeSingle();

  if (lecture || !appel) {
    return {
      ok: false,
      resume: null,
      donnees: null,
      erreur: "Appel introuvable.",
      simule: false,
    };
  }

  if (appel.summary_status === "DONE" && !options.force) {
    return { ok: true, resume: null, donnees: null, simule: false };
  }

  const { data: segments } = await admin
    .from("call_transcript_segments")
    .select("speaker, content")
    .eq("call_id", callId)
    .order("ordinal")
    .limit(500);

  const tours = (segments ?? []) as Tour[];

  if (tours.length === 0) {
    await echouer(
      callId,
      appel.summary_attempts as number,
      "Aucune transcription pour cet appel.",
    );
    return {
      ok: false,
      resume: null,
      donnees: null,
      erreur: "Aucune transcription pour cet appel.",
      simule: false,
    };
  }

  const conversation = transcriptionEnTexte(tours);
  const fournisseur = aiProvider();

  await admin
    .from("calls")
    .update({ summary_status: "RUNNING" })
    .eq("id", callId);

  // Les deux demandes sont indépendantes, et lancées ensemble : l'appel est
  // déjà terminé, personne n'attend au téléphone, mais le webhook, lui, a une
  // durée maximum.
  const [resumeBrut, donneesBrutes] = await Promise.all([
    fournisseur.complete({
      system: PROMPT_RESUME,
      user: `Voici la transcription de l'appel :\n\n${conversation}\n\nRésume-le.`,
      maxOutputTokens: 300,
    }),
    fournisseur.complete({
      system: PROMPT_DONNEES,
      user:
        `Voici la transcription de l'appel :\n\n${conversation}\n\n` +
        "Extrais les champs demandés. Omets ceux dont tu n'as pas entendu la valeur.",
      json: {
        name: "extraction_appel",
        schema: SCHEMA_DONNEES as Record<string, unknown>,
      },
      maxOutputTokens: 500,
    }),
  ]);

  const resume = resumeBrut.text;
  const donnees = nettoyerDonnees(donneesBrutes.json);

  if (!resume && !donnees) {
    const erreur =
      resumeBrut.error ??
      donneesBrutes.error ??
      "Le fournisseur n'a rien renvoyé.";
    await echouer(
      callId,
      appel.summary_attempts as number,
      erreur,
      appel.organization_id as string | null,
    );
    return {
      ok: false,
      resume: null,
      donnees: null,
      erreur,
      simule: fournisseur.isMock,
    };
  }

  const { error: ecriture } = await admin
    .from("calls")
    .update({
      summary: resume,
      structured_data: donnees,
      // Un résumé obtenu sans extraction reste un succès : l'inverse aussi.
      // Ce qui serait faux, c'est d'annoncer DONE quand rien n'a été produit.
      summary_status: "DONE",
      summary_error: resume ? null : (donneesBrutes.error ?? null),
      summary_attempts: (appel.summary_attempts as number) + 1,
      summary_source: fournisseur.isMock
        ? "MOCK"
        : `${fournisseur.name}:${fournisseur.model}`,
      summary_generated_at: new Date().toISOString(),
    })
    .eq("id", callId);

  if (ecriture) {
    await echouer(
      callId,
      appel.summary_attempts as number,
      `Résumé produit mais non enregistré : ${ecriture.message}`,
      appel.organization_id as string | null,
    );
    return {
      ok: false,
      resume,
      donnees,
      erreur: "Le résumé n'a pas pu être enregistré.",
      simule: fournisseur.isMock,
    };
  }

  // Un resume simule ne prouve rien : seul un vrai echange compte comme
  // preuve que l integration fonctionne aujourd hui.
  if (!fournisseur.isMock) {
    await noterEchangeReussi("AI", `${fournisseur.name}:${fournisseur.model}`);
  }

  return { ok: true, resume, donnees, simule: fournisseur.isMock };
}

async function echouer(
  callId: string,
  tentatives: number,
  erreur: string,
  organizationId?: string | null,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("calls")
    .update({
      summary_status: "FAILED",
      summary_error: erreur.slice(0, 300),
      summary_attempts: tentatives + 1,
    })
    .eq("id", callId);
  console.error("[intelligence] résumé échoué", callId, erreur);

  // La fiche d'appel dit « Résumé indisponible » au professionnel. Ce journal
  // dit à l'exploitation que c'est le fournisseur qui tombe, et depuis quand.
  // Sans lui, un modèle en panne depuis trois jours ressemble à trois appels
  // bizarres.
  await signalerErreurFournisseur({
    provider: "AI",
    operation: "genererIntelligenceAppel",
    message: erreur,
    organizationId: organizationId ?? null,
    correlationId: callId,
  });
}

/**
 * Écarte ce que le modèle a inventé pour remplir le schéma.
 *
 * Les modèles rendent volontiers `null`, `"inconnu"`, `"N/A"` ou une chaîne
 * vide quand ils n'ont pas la réponse. Ces valeurs seraient affichées à
 * l'artisan comme des informations collectées. Un champ absent est honnête ;
 * un champ qui dit « inconnu » encombre, et un champ vide ment.
 */
export function nettoyerDonnees(
  brut: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!brut) return null;

  const VIDES = new Set([
    "",
    "null",
    "n/a",
    "na",
    "inconnu",
    "inconnue",
    "non précisé",
    "non precise",
    "non renseigné",
    "non renseigne",
    "unknown",
    "none",
    "-",
  ]);

  const propre: Record<string, unknown> = {};

  for (const [cle, valeur] of Object.entries(brut)) {
    if (valeur === null || valeur === undefined) continue;
    if (typeof valeur === "string") {
      const texte = valeur.trim();
      if (texte.length === 0 || VIDES.has(texte.toLowerCase())) continue;
      propre[cle] = texte;
      continue;
    }
    if (typeof valeur === "boolean" || typeof valeur === "number") {
      propre[cle] = valeur;
      continue;
    }
    // Objets et tableaux : conservés tels quels, le schéma n'en prévoit pas.
    propre[cle] = valeur;
  }

  return Object.keys(propre).length > 0 ? propre : null;
}
