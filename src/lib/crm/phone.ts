/**
 * Numéros de téléphone : normalisation et vraisemblance.
 *
 * Deux choses distinctes, et les confondre coûte cher.
 *
 * **Normaliser** met un numéro en forme internationale. `0470 12 34 56` et
 * `+32470123456` deviennent la même chaîne, ce qui permet de reconnaître un
 * client au deuxième appel.
 *
 * **Vérifier la vraisemblance** répond à une autre question : ce numéro
 * peut-il exister ? La base acceptait jusqu'ici n'importe quelle suite de
 * chiffres. Un numéro dicté au téléphone et mal transcrit — « zéro quatre,
 * sept deux, douze, trente-quatre » devenu `04 72 12 34` — était enregistré
 * tel quel. L'artisan rappelait un numéro qui n'existe pas, ou pire, quelqu'un
 * d'autre.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne dit pas si un numéro est **attribué**. Seul un appel le dit. Il écarte
 * l'impossible, pas l'inexact : `+32470123456` est vraisemblable même si
 * personne ne le détient.
 *
 * Il n'est strict que pour la France et la Belgique, les deux marchés de
 * lancement. Ailleurs, il applique les seules bornes universelles de la norme
 * E.164. Prétendre connaître les plans de numérotation du monde entier serait
 * une invitation à rejeter de vrais clients.
 */

export type PhoneOrigin = "NETWORK" | "DICTATED" | "MANUAL";

export interface PhoneCheck {
  /** Le numéro en forme internationale, ou `null` s'il est inutilisable. */
  e164: string | null;
  plausible: boolean;
  /** Ce qui ne va pas, formulé pour être dit à voix haute par Sophie. */
  reason?: string;
}

/** Indicatif par défaut quand l'appelant donne un numéro national. */
const DEFAUT = "32";

export function normalisePhone(raw: string, defaultCountry = DEFAUT): string | null {
  const brut = raw.trim();
  if (brut.length === 0) return null;

  const plus = brut.startsWith("+");
  const chiffres = brut.replace(/\D/g, "");
  if (chiffres.length === 0) return null;

  if (plus) return `+${chiffres}`;
  if (chiffres.startsWith("00")) return `+${chiffres.slice(2)}`;
  if (chiffres.startsWith("0")) return `+${defaultCountry}${chiffres.slice(1)}`;

  return `+${chiffres}`;
}

/**
 * Longueurs nationales acceptées, hors indicatif pays.
 *
 * Belgique : 9 chiffres pour un mobile (4xx xx xx xx), 8 pour un fixe
 * bruxellois (2 xxx xx xx). Les deux existent et sont courants.
 *
 * France : 9 chiffres, toutes zones confondues, après le 0 initial.
 */
const LONGUEURS: Record<string, readonly number[]> = {
  "32": [8, 9],
  "33": [9],
};

export function checkPhone(raw: string, defaultCountry = DEFAUT): PhoneCheck {
  const e164 = normalisePhone(raw, defaultCountry);

  if (!e164) {
    return { e164: null, plausible: false, reason: "Aucun chiffre reconnu." };
  }

  const chiffres = e164.slice(1);

  // Bornes de la norme E.164 : 7 chiffres au minimum en comptant l'indicatif,
  // 15 au maximum. En deçà et au-delà, aucun numéro ne peut exister.
  if (chiffres.length < 7) {
    return {
      e164,
      plausible: false,
      reason: "Ce numéro est trop court. Faites-le répéter chiffre par chiffre.",
    };
  }

  if (chiffres.length > 15) {
    return {
      e164,
      plausible: false,
      reason: "Ce numéro est trop long. Faites-le répéter chiffre par chiffre.",
    };
  }

  for (const [indicatif, longueurs] of Object.entries(LONGUEURS)) {
    if (!chiffres.startsWith(indicatif)) continue;

    const national = chiffres.slice(indicatif.length);
    if (longueurs.includes(national.length)) return { e164, plausible: true };

    const attendu = longueurs.join(" ou ");
    return {
      e164,
      plausible: false,
      reason:
        `Ce numéro a ${national.length} chiffres après l'indicatif, ` +
        `il en faut ${attendu}. Faites-le répéter chiffre par chiffre.`,
    };
  }

  // Pays non couvert : on ne sait pas, donc on accepte.
  return { e164, plausible: true };
}
