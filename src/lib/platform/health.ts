import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import {
  INTEGRATIONS,
  missingEnvFor,
  type IntegrationEntry,
} from "@/lib/providers/status";
import { fournisseur } from "@/lib/config/catalogue";

/**
 * Santé réelle d'une intégration.
 *
 * ## Le problème que ce module corrige
 *
 * L'écran de santé affichait « Testé en conditions réelles » juste au-dessus
 * de « Variables manquantes : VOICE_PROVIDER ». Deux affirmations
 * contradictoires sur la même carte, et les deux étaient exactes : l'une
 * venait d'un registre écrit à la main dans le code, l'autre de
 * l'environnement lu au moment de l'affichage.
 *
 * Le défaut n'était pas l'affichage, c'était le modèle : un seul mot — le
 * statut — portait trois questions différentes.
 *
 * ## Les quatre questions, séparées
 *
 * 1. **Le code sait-il le faire ?** Vient du registre. Ne change qu'avec une
 *    livraison.
 * 2. **La configuration le permet-elle aujourd'hui ?** Vient des variables
 *    d'environnement. Change dès qu'on touche Vercel.
 * 3. **Quand un échange réel a-t-il réussi pour la dernière fois ?** Vient de
 *    la base (`integration_checks`). C'est la seule preuve datée.
 * 4. **Qu'est-ce qui a échoué récemment ?** Vient de `provider_errors`.
 *
 * ## La règle
 *
 * Un test réussi le 23 octobre ne prouve rien sur aujourd'hui. Une intégration
 * dont la configuration est incomplète est **hors service**, quel que soit son
 * passé. C'est le présent qui décide de l'état affiché ; le passé n'est qu'une
 * information de contexte.
 */

export type EtatSante =
  /** Configuration complète et dernier échange réussi. */
  | "OPERATIONNEL"
  /** Configuration complète, mais le dernier échange a échoué. */
  | "EN_PANNE"
  /** Configuration incomplète : rien ne peut fonctionner. */
  | "NON_CONFIGURE"
  /**
   * Configuration complète, mais aucune trace d'échange.
   *
   * Ce n'est pas « ça ne marche pas ». Supabase fait tourner l'application
   * pendant qu'on lit cet écran, et Google Agenda a été vérifié en octobre :
   * ni l'un ni l'autre n'écrivait de trace à l'époque. L'absence d'historique
   * est une absence de mesure, pas un diagnostic — et l'afficher comme un
   * diagnostic ferait douter de ce qui fonctionne.
   */
  | "HISTORIQUE_ABSENT";

export const LIBELLES_ETAT: Record<EtatSante, string> = {
  OPERATIONNEL: "Opérationnel",
  EN_PANNE: "En panne",
  NON_CONFIGURE: "Non configuré",
  HISTORIQUE_ABSENT: "Historique non disponible",
};

export const TONS_ETAT: Record<
  EtatSante,
  "signal" | "urgent" | "attention" | "neutre"
> = {
  OPERATIONNEL: "signal",
  EN_PANNE: "urgent",
  NON_CONFIGURE: "attention",
  HISTORIQUE_ABSENT: "neutre",
};

export interface SanteIntegration {
  cle: string;
  libelle: string;
  etat: EtatSante;
  /** Ce que le code sait faire, indépendamment de la configuration. */
  codeNote?: string;
  variablesManquantes: string[];
  dernierSucces: string | null;
  dernierEchec: string | null;
  dernierDetail: string | null;
  erreursRecentes: number;
  /** Un test de connexion existe-t-il pour ce fournisseur ? */
  testable: boolean;
  /** Ce qu'il faut faire ensuite, en une phrase. */
  action: string;
}

function action(
  etat: EtatSante,
  manquantes: string[],
  entry: IntegrationEntry,
  testable: boolean,
): string {
  switch (etat) {
    case "NON_CONFIGURE":
      return entry.blockedBy
        ? `${entry.blockedBy} Renseigner ensuite : ${manquantes.join(", ")}.`
        : `Renseigner sur Vercel : ${manquantes.join(", ")}.`;
    case "EN_PANNE":
      return "Lire le détail de l’échec ci-dessous, puis réessayer l’opération concernée.";
    case "HISTORIQUE_ABSENT":
      return testable
        ? "Configuration complète, aucune trace d’échange. Lancez un test de connexion pour obtenir une preuve datée."
        : "Configuration complète. Rien n’instrumente cette intégration : son état se vérifie ailleurs.";
    case "OPERATIONNEL":
      return "Rien à faire.";
  }
}

export async function santeIntegrations(): Promise<SanteIntegration[]> {
  const supabase = await createServerSupabase();

  const [controles, erreurs] = await Promise.all([
    supabase.rpc("integration_health"),
    supabase
      .from("provider_errors")
      .select("provider, occurred_at")
      .gte("occurred_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
      .limit(500),
  ]);

  const parIntegration = new Map<
    string,
    {
      last_ok: string | null;
      last_fail: string | null;
      last_detail: string | null;
    }
  >(
    (
      (controles.data ?? []) as {
        integration: string;
        last_ok: string | null;
        last_fail: string | null;
        last_detail: string | null;
      }[]
    ).map((ligne) => [ligne.integration, ligne]),
  );

  const comptesErreurs = new Map<string, number>();
  for (const erreur of (erreurs.data ?? []) as { provider: string }[]) {
    const cle = erreur.provider.toLowerCase();
    comptesErreurs.set(cle, (comptesErreurs.get(cle) ?? 0) + 1);
  }

  return INTEGRATIONS.map((entry) => {
    const manquantes = missingEnvFor(entry.key);
    const controle = parIntegration.get(entry.key);
    const catalogue = fournisseur(entry.key);

    const dernierSucces = controle?.last_ok ?? null;
    const dernierEchec = controle?.last_fail ?? null;

    let etat: EtatSante;
    if (manquantes.length > 0) {
      // Le présent l'emporte sur le passé : sans configuration, rien ne marche
      // aujourd'hui, même si tout marchait le mois dernier.
      etat = "NON_CONFIGURE";
    } else if (
      dernierEchec &&
      (!dernierSucces || dernierEchec > dernierSucces)
    ) {
      etat = "EN_PANNE";
    } else if (dernierSucces) {
      etat = "OPERATIONNEL";
    } else {
      etat = "HISTORIQUE_ABSENT";
    }

    return {
      cle: entry.key,
      libelle: entry.label,
      etat,
      codeNote: entry.notes,
      variablesManquantes: manquantes,
      dernierSucces,
      dernierEchec,
      dernierDetail: controle?.last_detail ?? null,
      erreursRecentes: comptesErreurs.get(entry.key) ?? 0,
      testable: catalogue?.testable ?? false,
      action: action(etat, manquantes, entry, catalogue?.testable ?? false),
    };
  });
}

/** Une date lisible, ou l'aveu qu'il n'y en a pas. */
export function quand(iso: string | null): string {
  if (!iso) return "jamais";
  return new Date(iso).toLocaleString("fr-BE", { timeZone: "Europe/Brussels" });
}
