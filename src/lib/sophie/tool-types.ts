import type { VoiceToolDefinition } from "@/lib/providers/voice/types";

/**
 * Contrat commun à tous les outils de Sophie.
 *
 * Séparé de `tools.ts` pour que les outils puissent vivre dans plusieurs
 * fichiers sans s'importer en cercle. Le contenu n'a pas changé.
 */

export interface ToolContext {
  organizationId: string;
  providerCallId: string;
  /** Vrai seulement dans une organisation d'essai (ADR-019). */
  isTest: boolean;
  /**
   * Numéro de l'appelant, en E.164 quand il est connu.
   *
   * Absent sur un essai depuis le navigateur, et absent aussi quand l'appelant
   * masque son numéro — ce qui arrive vraiment. Chaque outil qui s'en sert doit
   * prévoir le cas plutôt que de supposer qu'il est là.
   */
  callerNumber: string | null;
  /** Identifiant de l'appel chez nous, quand il a déjà été enregistré. */
  callId: string | null;
}

export interface ToolOutcome {
  /** Texte destiné à être prononcé ou utilisé par l'assistant. */
  result?: string;
  /** Erreur métier. Renvoyée avec un code HTTP 200 : voir la note du endpoint. */
  error?: string;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext,
) => Promise<ToolOutcome>;

export interface SophieTool {
  definition: VoiceToolDefinition;
  handler: ToolHandler;
}

/** Lit un argument texte, en refusant le vide et les valeurs non textuelles. */
export function texte(args: Record<string, unknown>, nom: string): string | null {
  const valeur = args[nom];
  if (typeof valeur !== "string") return null;
  const propre = valeur.trim();
  return propre.length > 0 ? propre : null;
}

/** Lit un argument numérique, en acceptant une chaîne de chiffres. */
export function nombre(args: Record<string, unknown>, nom: string): number | null {
  const valeur = args[nom];
  if (typeof valeur === "number" && Number.isFinite(valeur)) return valeur;
  if (typeof valeur === "string") {
    // `Number("")` vaut 0, et `Number("   ")` aussi. Or Vapi remplit volontiers
    // un paramètre absent par une chaîne vide : sans ce garde-fou, une durée
    // non renseignée devenait un rendez-vous de zéro minute.
    const propre = valeur.trim();
    if (propre.length === 0) return null;

    const converti = Number(propre);
    if (Number.isFinite(converti)) return converti;
  }
  return null;
}

/**
 * Vrai pour les formes affirmatives que produit un modèle, quel que soit le
 * type qu'il choisit. Il envoie « true », « oui », `true`, parfois « yes ».
 */
export function vrai(args: Record<string, unknown>, nom: string): boolean {
  const valeur = args[nom];
  if (typeof valeur === "boolean") return valeur;
  if (typeof valeur === "string") {
    return ["true", "oui", "yes", "1"].includes(valeur.trim().toLowerCase());
  }
  return false;
}
