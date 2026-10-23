/**
 * L'état réel de la ligne de Sophie.
 *
 * L'en-tête de l'application affichait « Sophie en pause » en permanence : la
 * valeur était écrite en dur dans la mise en page, en attendant la téléphonie.
 * La téléphonie est arrivée, pas la valeur. Un voyant qui ne regarde rien est
 * pire qu'une absence de voyant — il répond à la question sans la poser.
 *
 * Quatre conditions, et il suffit qu'une seule manque pour qu'aucun client ne
 * puisse joindre Sophie. Elles sont rendues dans l'ordre où il faut les
 * traiter : sans numéro, activer Sophie ne sert à rien.
 */

export type RaisonSilence =
  /** Aucun numéro relié : un appel entrant ne peut même pas être rattaché. */
  | "AUCUN_NUMERO"
  /** Seule une ligne d'essai existe : les appels arrivent, marqués essai. */
  | "LIGNE_ESSAI"
  /** Sophie n'a pas été activée. */
  | "CONFIG_INACTIVE"
  /** Sophie est réglée pour ne jamais décrocher. */
  | "MODE_OFF";

export interface EtatLigneSophie {
  /** Vrai seulement si un vrai client peut réellement joindre Sophie. */
  repond: boolean;
  raison: RaisonSilence | null;
  /** Le premier numéro relié, pour l'afficher au professionnel. */
  numero: string | null;
}

export interface ConfigurationSophie {
  is_active: boolean;
  answer_mode: string;
}

export interface NumeroRelie {
  e164: string;
  is_test: boolean;
  is_active: boolean;
}

export function diagnostiquerLigne(
  configuration: ConfigurationSophie | null,
  numeros: NumeroRelie[],
): EtatLigneSophie {
  const actifs = numeros.filter((n) => n.is_active);
  const reels = actifs.filter((n) => !n.is_test);
  const numero = (reels[0] ?? actifs[0])?.e164 ?? null;

  if (actifs.length === 0) return { repond: false, raison: "AUCUN_NUMERO", numero: null };
  if (reels.length === 0) return { repond: false, raison: "LIGNE_ESSAI", numero };
  if (!configuration?.is_active) return { repond: false, raison: "CONFIG_INACTIVE", numero };
  if (configuration.answer_mode === "OFF") return { repond: false, raison: "MODE_OFF", numero };

  return { repond: true, raison: null, numero };
}

/** Ce qu'on dit au professionnel, et ce qu'il doit faire ensuite. */
export const MESSAGE_SILENCE: Record<RaisonSilence, { titre: string; detail: string }> = {
  AUCUN_NUMERO: {
    titre: "Sophie n’a pas encore de numéro",
    detail:
      "Aucun numéro de téléphone n’est relié à votre entreprise. Vos appels sont donc " +
      "marqués « essai » : ils n’apparaissent pas dans ce qui presse et ne comptent dans " +
      "aucun chiffre.",
  },
  LIGNE_ESSAI: {
    titre: "Seule une ligne d’essai est reliée",
    detail:
      "Les appels arrivent bien, mais ils sont marqués « essai ». Ils ne déclenchent " +
      "aucune alerte, pour ne pas créer de faux travail.",
  },
  CONFIG_INACTIVE: {
    titre: "Sophie n’est pas activée",
    detail: "Votre numéro est relié, mais Sophie ne décroche pas tant qu’elle n’est pas activée.",
  },
  MODE_OFF: {
    titre: "Sophie est réglée pour ne jamais décrocher",
    detail: "Choisissez quand elle doit répondre dans les réglages d’appel.",
  },
};
