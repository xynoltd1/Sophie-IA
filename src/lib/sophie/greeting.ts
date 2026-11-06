/**
 * La première phrase que le client entend.
 *
 * ## Pourquoi ce module est pur
 *
 * Il ne lit ni la base, ni l'environnement, ni l'heure système. Tout entre par
 * les paramètres. C'est ce qui permet de vérifier par un test que deux
 * entreprises obtiennent deux phrases différentes, sans monter une base.
 *
 * ## La forme retenue
 *
 * « Martin Plomberie, bonjour. Je suis Zeli, votre assistante virtuelle.
 * Comment puis-je vous aider ? »
 *
 * Le nom de l'entreprise d'abord. C'est ainsi que décroche une vraie
 * secrétaire, et cela répond tout de suite à la question que se pose
 * l'appelant : « est-ce que j'ai composé le bon numéro ? ». Une phrase qui
 * commence par « Bonjour, ici Zeli » laisse cette question ouverte pendant
 * trois secondes.
 *
 * ## L'obligation qui ne se règle pas
 *
 * L'article 50 du règlement (UE) 2024/1689 impose que l'appelant sache qu'il
 * parle à une machine. Le texte d'accueil est libre ; cette mention ne l'est
 * pas. Si la formule saisie par l'entreprise ne la contient pas,
 * `composerAccueil` l'ajoute. Elle ne refuse pas la formule et ne la remplace
 * pas : un accueil amputé serait un accueil cassé, et une obligation retirée
 * serait notre faute, pas celle du client.
 */

/** Les variables utilisables dans une formule d'accueil. */
export const VARIABLES = [
  { cle: "entreprise", exemple: "Martin Plomberie" },
  { cle: "assistante", exemple: "Zeli" },
  { cle: "metier", exemple: "plomberie" },
  { cle: "moment", exemple: "bonjour / bonsoir" },
] as const;

export type CleVariable = (typeof VARIABLES)[number]["cle"];

export const MODELE_PAR_DEFAUT =
  "{entreprise}, {moment}. Je suis {assistante}, votre assistante virtuelle. Comment puis-je vous aider ?";

export const MODELE_HORS_HORAIRES =
  "{entreprise}, {moment}. Je suis {assistante}, votre assistante virtuelle. " +
  "Le bureau est fermé, mais je prends votre demande et je la transmets.";

/** Phrase ajoutée quand la formule saisie oublie de dire que c'est une machine. */
export const MENTION_IA = "Je suis une assistante virtuelle.";

export const LONGUEUR_MAX = 400;

export type Moment = "MATIN" | "APRES_MIDI" | "SOIR";

/**
 * Le moment de la journée, dans le fuseau de l'entreprise.
 *
 * Le fuseau compte : le serveur tourne en UTC, et un appel reçu à 20 h à
 * Bruxelles arriverait sinon avec un « bonjour » de 19 h UTC.
 */
export function momentDeLaJournee(instant: Date, timezone: string): Moment {
  let heure: number;
  try {
    heure = Number(
      new Intl.DateTimeFormat("fr-FR", {
        timeZone: timezone,
        hour: "2-digit",
        hour12: false,
      }).format(instant),
    );
  } catch {
    // Fuseau inconnu : on prend l'heure UTC plutôt que de ne rien dire.
    heure = instant.getUTCHours();
  }

  if (!Number.isFinite(heure)) heure = instant.getUTCHours();
  if (heure < 12) return "MATIN";
  if (heure < 18) return "APRES_MIDI";
  return "SOIR";
}

/** « bonjour » ou « bonsoir », selon le moment. */
export function salutation(moment: Moment): string {
  return moment === "SOIR" ? "bonsoir" : "bonjour";
}

export interface EntreesAccueil {
  /** La formule choisie. Vide ou absente : le modèle par défaut sert. */
  modele?: string | null;
  /** Le nom prononcé au téléphone. */
  entreprise: string;
  /** Le nom de l'assistante, tel que configuré. */
  assistante: string;
  /** Le métier, pour les formules qui le mentionnent. Facultatif. */
  metier?: string | null;
  moment: Moment;
}

/**
 * Remplace les variables et garantit la mention d'IA.
 *
 * Une variable inconnue est laissée telle quelle plutôt que vidée : voir
 * `{ancienNom}` dans l'aperçu dit immédiatement ce qui ne va pas, tandis
 * qu'un trou silencieux se découvre au téléphone.
 */
export function composerAccueil(entrees: EntreesAccueil): string {
  const modele = (entrees.modele ?? "").trim() || MODELE_PAR_DEFAUT;

  const valeurs: Record<CleVariable, string> = {
    entreprise: entrees.entreprise.trim(),
    assistante: entrees.assistante.trim(),
    metier: (entrees.metier ?? "").trim(),
    moment: salutation(entrees.moment),
  };

  let texte = modele.replace(/\{([a-zA-Zéè_]+)\}/g, (brut, nom: string) => {
    const cle = nom.toLowerCase() as CleVariable;
    return cle in valeurs ? valeurs[cle] : brut;
  });

  // Une variable facultative laissée vide produit « , bonjour » ou deux
  // espaces. On recolle la phrase plutôt que de la prononcer bancale.
  //
  // La virgule et le point seulement : en français, « ? » et « ! » prennent
  // une espace avant. La retirer donnerait un aperçu mal typographié, que
  // l'artisan corrigerait à la main en croyant à une faute de sa part.
  texte = texte
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/([,;])\s*([,.;])/g, "$2")
    .replace(/^[\s,;.]+/, "")
    .trim();

  if (!disclosesAI(texte)) {
    texte = `${texte} ${MENTION_IA}`.trim();
  }

  return texte.length > LONGUEUR_MAX
    ? `${texte.slice(0, LONGUEUR_MAX - 1).trimEnd()}…`
    : texte;
}

/** La formule à utiliser, parmi celles configurées. */
export function modelePourMoment(params: {
  base?: string | null;
  matin?: string | null;
  soir?: string | null;
  horsHoraires?: string | null;
  moment: Moment;
  ouvert: boolean;
}): string | null {
  if (!params.ouvert && params.horsHoraires?.trim()) {
    return params.horsHoraires;
  }
  if (params.moment === "MATIN" && params.matin?.trim()) return params.matin;
  if (params.moment === "SOIR" && params.soir?.trim()) return params.soir;
  return params.base ?? null;
}

export interface ProblemeAccueil {
  champ: string;
  message: string;
}

/**
 * Ce qui empêche une formule d'être enregistrée.
 *
 * On refuse peu de choses : une formule trop courte pour dire quoi que ce
 * soit, une formule trop longue pour être écoutée, et une variable inventée.
 * L'absence de mention d'IA n'est PAS un refus — elle est corrigée à la
 * prononciation, et l'écran le dit.
 */
export function verifierModele(
  modele: string,
  champ = "greeting",
): ProblemeAccueil[] {
  const problemes: ProblemeAccueil[] = [];
  const texte = modele.trim();

  if (texte.length > 0 && texte.length < 10) {
    problemes.push({ champ, message: "Trop court pour être un accueil." });
  }

  if (texte.length > LONGUEUR_MAX) {
    problemes.push({
      champ,
      message: `Trop long : ${texte.length} caractères, maximum ${LONGUEUR_MAX}. Au-delà, l’appelant raccroche avant la fin.`,
    });
  }

  const connues = new Set<string>(VARIABLES.map((v) => v.cle));
  for (const trouvee of texte.matchAll(/\{([^}]*)\}/g)) {
    const nom = (trouvee[1] ?? "").trim().toLowerCase();
    if (!connues.has(nom)) {
      problemes.push({
        champ,
        message: `Variable inconnue : {${trouvee[1]}}. Disponibles : ${[
          ...connues,
        ]
          .map((c) => `{${c}}`)
          .join(", ")}.`,
      });
    }
  }

  return problemes;
}

/**
 * Assemble ce qui sera réellement prononcé en premier.
 *
 * L'annonce légale et l'accueil commercial sont deux textes distincts, et
 * c'est délibéré : la demande était un accueil court et naturel, pas la
 * suppression d'une obligation. Séparés, on peut raccourcir l'un sans toucher
 * à l'autre, et la position se règle.
 */
export function premierMessage(params: {
  accueil: string;
  annonce?: string | null;
  position: "APRES_ACCUEIL" | "AVANT_ACCUEIL";
}): string {
  const annonce = (params.annonce ?? "").trim();
  if (!annonce) return params.accueil;

  return params.position === "AVANT_ACCUEIL"
    ? `${annonce} ${params.accueil}`.trim()
    : `${params.accueil} ${annonce}`.trim();
}

/**
 * Vérifie qu'un texte d'annonce dit bien qu'il s'agit d'une IA.
 *
 * Utilisé avant d'envoyer la configuration au fournisseur de voix. Le modèle
 * reformule volontiers ce qu'on lui demande de dire ; cette vérification porte
 * sur le texte que NOUS imposons, pas sur ce que le modèle improvisera.
 */
export function disclosesAI(text: string): boolean {
  const normalise = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const marqueurs = [
    "assistant virtuel",
    "assistante virtuelle",
    "systeme automatise",
    "intelligence artificielle",
    "repondeur automatique",
  ];

  return marqueurs.some((marqueur) => normalise.includes(marqueur));
}
