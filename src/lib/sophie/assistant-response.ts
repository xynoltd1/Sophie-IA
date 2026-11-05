/**
 * La réponse envoyée au fournisseur vocal quand le téléphone sonne.
 *
 * Pure, et séparée de la route, pour une raison précise : c'est le seul
 * endroit qui décide ce qui sera prononcé. Enfouie dans un gestionnaire HTTP,
 * cette décision ne se vérifierait qu'en lisant le code ou en appelant un
 * vrai numéro. Ici, un test peut affirmer que deux entreprises obtiennent
 * deux phrases différentes, et qu'un numéro inconnu n'en obtient aucune.
 *
 * ## La forme de la réponse
 *
 * `{ assistantId, assistantOverrides }` : l'assistant enregistré chez le
 * fournisseur porte les outils de Sophie, et nous ne remplaçons que les mots.
 * Un assistant construit de toutes pièces à chaque appel devrait porter aussi
 * les quatorze outils, et une erreur dans cette liste couperait Sophie de la
 * base pendant la conversation.
 *
 * `variableValues` est la voie documentée par le fournisseur. L'assistant
 * enregistré porte `{{premierMessage}}` comme première phrase. `firstMessage`
 * est envoyé en plus : s'il est honoré, tant mieux ; s'il est ignoré, la
 * variable produit exactement la même phrase. Aucune des deux voies n'est
 * seule responsable du résultat.
 */

export interface AccueilPourFournisseur {
  premierMessage: string;
  accueil: string;
  annonce: string | null;
  entreprise: string;
  assistante: string;
  metier: string | null;
  comportement: string | null;
  voiceId: string | null;
}

export type MotifRefus =
  | "NUMERO_INCONNU"
  | "ORGANISATION_SUPPRIMEE"
  | "SOPHIE_INACTIVE"
  | "SANS_ASSISTANT"
  | "PANNE";

/**
 * Ce qui est dit quand Sophie ne décroche pas.
 *
 * Aucune de ces phrases ne nomme une entreprise. À ce stade, on ne sait pas
 * laquelle — c'est la raison même du refus — et en nommer une au hasard
 * serait la faute que toute cette architecture cherche à éviter.
 */
export const MESSAGES_REFUS: Record<MotifRefus, string> = {
  NUMERO_INCONNU:
    "Ce numéro n’est rattaché à aucune entreprise. Vérifiez le numéro composé.",
  ORGANISATION_SUPPRIMEE:
    "Cette ligne n’est plus en service. Merci de votre appel.",
  SOPHIE_INACTIVE:
    "L’assistante téléphonique n’est pas activée sur cette ligne pour le moment.",
  SANS_ASSISTANT:
    "L’assistante téléphonique n’est pas encore configurée sur cette ligne.",
  PANNE:
    "Je ne peux pas prendre votre appel pour le moment. Merci de rappeler dans quelques minutes.",
};

export interface ReponseAssistant {
  assistantId: string;
  assistantOverrides: {
    variableValues: Record<string, string>;
    firstMessage: string;
    voice?: { provider: string; voiceId: string };
  };
}

export interface ReponseRefus {
  error: string;
}

export function reponseAssistant(
  assistantId: string,
  accueil: AccueilPourFournisseur,
): ReponseAssistant {
  return {
    assistantId,
    assistantOverrides: {
      variableValues: {
        premierMessage: accueil.premierMessage,
        accueil: accueil.accueil,
        entreprise: accueil.entreprise,
        assistante: accueil.assistante,
        metier: accueil.metier ?? "",
        annonce: accueil.annonce ?? "",
        comportement: accueil.comportement ?? "",
      },
      firstMessage: accueil.premierMessage,
      ...(accueil.voiceId
        ? { voice: { provider: "azure", voiceId: accueil.voiceId } }
        : {}),
    },
  };
}

export function reponseRefus(motif: MotifRefus): ReponseRefus {
  return { error: MESSAGES_REFUS[motif] };
}
