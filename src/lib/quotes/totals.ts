/**
 * Les calculs d'un devis.
 *
 * ## Pourquoi ce module est pur
 *
 * Il est importé des deux côtés : par l'écran, qui montre les totaux pendant
 * que l'artisan tape, et par les tests. Le serveur, lui, ne s'en sert pas pour
 * décider : les totaux stockés sont recalculés en base, par déclencheur.
 *
 * Les deux doivent donner le même chiffre au centime près, sinon l'écran
 * affiche un total et la base en garde un autre. C'est la même règle que pour
 * l'accueil téléphonique : l'aperçu doit dire ce qui sera réellement
 * enregistré, pas une approximation.
 *
 * ## Tout est en centimes entiers
 *
 * Jamais de nombre à virgule pour de l'argent. En virgule flottante,
 * `0.1 + 0.2` ne fait pas `0.3`, et `1.15 * 100` fait `114.99999999999999`.
 * Un devis dont le total diffère d'un centime de la somme de ses lignes est un
 * devis que le client conteste.
 *
 * La quantité, elle, a deux décimales (1,5 heure ; 12,25 mètres). Elle est
 * donc manipulée en centièmes entiers, jamais telle quelle.
 *
 * ## L'arrondi se fait par ligne
 *
 * C'est l'usage comptable, et c'est aussi le seul qui tienne : arrondir
 * uniquement à la fin fait diverger le total de la somme des lignes affichées.
 * Le client additionne ce qu'il voit.
 */

export interface LigneDevis {
  /** Quantité, au centième près. */
  quantity: number;
  /** Prix unitaire hors taxes, en centimes entiers. */
  unit_price_cents: number;
  /** Taux de TVA en pourcentage : 21, 6, 0. */
  vat_rate: number;
}

export interface TotauxDevis {
  horsTva: number;
  tva: number;
  ttc: number;
  /** Le détail par taux, pour le pied du document. */
  parTaux: { taux: number; base: number; tva: number }[];
}

/** La quantité en centièmes entiers, à l'abri de la virgule flottante. */
function centiemes(quantite: number): number {
  return Math.round(quantite * 100);
}

/**
 * Le montant hors taxes d'une ligne, arrondi au centime.
 *
 * `quantité × prix` passe par des entiers : 1,15 × 100 centimes donne
 * 115 × 100 ÷ 100 = 115, là où le calcul direct donnerait 114,999…
 */
export function ligneHorsTva(ligne: LigneDevis): number {
  const produit =
    centiemes(ligne.quantity) * Math.round(ligne.unit_price_cents);
  return Math.round(produit / 100);
}

/** La TVA d'une ligne, calculée sur son montant déjà arrondi. */
export function ligneTva(ligne: LigneDevis): number {
  // Le taux a deux décimales en base. On passe par les centièmes de point
  // pour la même raison que la quantité.
  const taux = Math.round(ligne.vat_rate * 100);
  return Math.round((ligneHorsTva(ligne) * taux) / 10_000);
}

export function totaux(lignes: LigneDevis[]): TotauxDevis {
  const parTaux = new Map<number, { base: number; tva: number }>();
  let horsTva = 0;
  let tva = 0;

  for (const ligne of lignes) {
    const base = ligneHorsTva(ligne);
    const taxe = ligneTva(ligne);

    horsTva += base;
    tva += taxe;

    const cumul = parTaux.get(ligne.vat_rate) ?? { base: 0, tva: 0 };
    parTaux.set(ligne.vat_rate, {
      base: cumul.base + base,
      tva: cumul.tva + taxe,
    });
  }

  return {
    horsTva,
    tva,
    ttc: horsTva + tva,
    parTaux: [...parTaux.entries()]
      .map(([taux, montants]) => ({ taux, ...montants }))
      .sort((a, b) => a.taux - b.taux),
  };
}

/** Des centimes vers « 1 234,50 € ». */
export function euros(centimes: number): string {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
  }).format(centimes / 100);
}

/**
 * Les taux de TVA proposés.
 *
 * Ce sont ceux que rencontre un artisan en Belgique et en France. La liste
 * aide à saisir ; elle ne décide pas à la place de l'artisan, qui reste seul
 * juge du taux applicable à son chantier — c'est lui qui connaît l'âge du
 * logement et la nature des travaux.
 */
export const TAUX_TVA = [
  { taux: 21, libelle: "21 % — taux normal" },
  { taux: 6, libelle: "6 % — rénovation, logement de plus de 10 ans" },
  { taux: 0, libelle: "0 % — exonéré ou autoliquidation" },
] as const;

export type EtatDevis =
  "BROUILLON" | "ENVOYE" | "ACCEPTE" | "REFUSE" | "EXPIRE";

export const ETATS_DEVIS: Record<
  EtatDevis,
  { libelle: string; ton: "neutre" | "signal" | "attention" | "urgent" }
> = {
  BROUILLON: { libelle: "Brouillon", ton: "neutre" },
  ENVOYE: { libelle: "Envoyé", ton: "attention" },
  ACCEPTE: { libelle: "Accepté", ton: "signal" },
  REFUSE: { libelle: "Refusé", ton: "urgent" },
  EXPIRE: { libelle: "Expiré", ton: "neutre" },
};

/**
 * Peut-on encore modifier ce devis ?
 *
 * Un devis envoyé est entre les mains du client. Le modifier ensuite
 * laisserait deux versions en circulation sans que rien ne le signale. La base
 * refuse aussi, par déclencheur : cette fonction sert à griser les boutons,
 * pas à protéger.
 */
export function modifiable(etat: EtatDevis): boolean {
  return etat === "BROUILLON";
}
