/**
 * Séparer les visites humaines du reste.
 *
 * ## Ce que cette méthode peut et ne peut pas faire
 *
 * Elle ne peut pas être sûre. Un robot bien écrit ressemble exactement à un
 * navigateur : même agent utilisateur, même ordre d'en-têtes, mêmes requêtes.
 * Aucune méthode côté serveur ne le distingue de façon fiable, et toute
 * solution qui prétend le contraire ment ou profile l'utilisateur.
 *
 * D'où **trois** réponses et non deux. `HUMAN` et `BOT` sont des jugements ;
 * `UNKNOWN` est le refus d'en porter un. Les trois sont comptés séparément,
 * et l'écran affiche les trois. Un chiffre de visiteurs qui aurait absorbé
 * l'incertitude dans l'une des deux certitudes serait faux sans qu'on puisse
 * le savoir.
 *
 * ## Ce qui n'est pas fait, délibérément
 *
 * Rien n'est bloqué. Googlebot et Bingbot sont exclus du comptage **et**
 * parfaitement libres de parcourir le site : les exclure des statistiques est
 * une décision de mesure, pas de sécurité. Les empêcher d'entrer coûterait le
 * référencement, qui est précisément ce qu'on cherche à obtenir.
 *
 * Aucune empreinte de navigateur n'est calculée. Elle améliorerait la
 * détection et transformerait la mesure en traceur, donc en obligation de
 * consentement.
 */

export type Classification = "HUMAN" | "BOT" | "UNKNOWN";

export interface Verdict {
  classification: Classification;
  /** Pourquoi. Sans cette trace, la méthode n'est ni vérifiable ni corrigible. */
  reason: string;
}

/**
 * Fragments d'agents utilisateurs déclarés.
 *
 * Ces robots-là s'annoncent : les reconnaître ne demande aucune ruse. Ce sont
 * aussi ceux qui font le gros du trafic automatisé d'un petit site.
 */
const ROBOTS_DECLARES = [
  "bot",
  "crawler",
  "spider",
  "crawling",
  "googlebot",
  "bingbot",
  "yandex",
  "baiduspider",
  "duckduckbot",
  "slurp",
  "applebot",
  "petalbot",
  "sogou",
  "exabot",
  "ia_archiver",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "telegrambot",
  "discordbot",
  "slackbot",
  "embedly",
  "quora link preview",
  "pinterest",
  "redditbot",
  "skypeuripreview",
  "ahrefs",
  "semrush",
  "mj12bot",
  "dotbot",
  "blexbot",
  "dataforseo",
  "screaming frog",
  "sitebulb",
  "serpstat",
  "gptbot",
  "oai-searchbot",
  "chatgpt-user",
  "claudebot",
  "claude-web",
  "anthropic-ai",
  "perplexitybot",
  "ccbot",
  "bytespider",
  "amazonbot",
  "uptimerobot",
  "pingdom",
  "statuscake",
  "site24x7",
  "newrelicpinger",
  "lighthouse",
  "pagespeed",
  "gtmetrix",
  "webpagetest",
] as const;

/** Outils d'automatisation : ils ne se cachent pas non plus. */
const OUTILS = [
  "headlesschrome",
  "phantomjs",
  "puppeteer",
  "playwright",
  "selenium",
  "cypress",
  "electron",
  "curl/",
  "wget",
  "python-requests",
  "python-urllib",
  "go-http-client",
  "java/",
  "okhttp",
  "axios/",
  "node-fetch",
  "httpie",
  "postmanruntime",
  "insomnia",
  "libwww-perl",
  "scrapy",
] as const;

export interface Signaux {
  userAgent: string | null;
  /** `navigator.webdriver`, envoyé par la page. Un vrai navigateur dit `false`. */
  webdriver?: boolean;
  /** La page a-t-elle été réellement affichée ? Un robot ne peint rien. */
  visible?: boolean;
  /** Largeur de l'écran annoncée. Zéro trahit un environnement sans écran. */
  largeurEcran?: number;
}

export function classifier(signaux: Signaux): Verdict {
  const ua = (signaux.userAgent ?? "").toLowerCase().trim();

  // Un agent utilisateur absent n'est pas une preuve de robot : des
  // navigateurs très restrictifs et certains réseaux d'entreprise le retirent.
  if (ua.length === 0) {
    return { classification: "UNKNOWN", reason: "aucun agent utilisateur" };
  }

  for (const fragment of ROBOTS_DECLARES) {
    if (ua.includes(fragment)) {
      return { classification: "BOT", reason: `robot déclaré : ${fragment}` };
    }
  }

  for (const outil of OUTILS) {
    if (ua.includes(outil)) {
      return { classification: "BOT", reason: `outil automatisé : ${outil}` };
    }
  }

  if (signaux.webdriver === true) {
    return { classification: "BOT", reason: "navigateur piloté (webdriver)" };
  }

  // Un agent utilisateur qui ne ressemble à aucun navigateur connu. On ne
  // tranche pas : les navigateurs rares existent, et les robots copient les
  // navigateurs courants.
  const ressembleNavigateur =
    ua.includes("mozilla/") || ua.includes("safari/") || ua.includes("opera");

  if (!ressembleNavigateur) {
    return {
      classification: "UNKNOWN",
      reason: "agent utilisateur inhabituel",
    };
  }

  // La page ne s'est jamais affichée : plausible pour un rendu sans écran,
  // plausible aussi pour un onglet ouvert en arrière-plan.
  if (signaux.visible === false) {
    return { classification: "UNKNOWN", reason: "page jamais affichée" };
  }

  if (signaux.largeurEcran !== undefined && signaux.largeurEcran <= 0) {
    return { classification: "UNKNOWN", reason: "aucune dimension d'écran" };
  }

  return { classification: "HUMAN", reason: "navigateur, affichage confirmé" };
}

/**
 * Les chemins dont la fréquentation est mesurée.
 *
 * L'application et l'administration sont exclues à la source : ce sont des
 * pages privées, leur fréquentation est du trafic interne, et la mélanger aux
 * visites du site public rendrait les deux chiffres faux.
 */
export function cheminPublic(chemin: string): boolean {
  if (!chemin.startsWith("/")) return false;
  if (chemin.length > 300) return false;

  const prives = [
    "/app",
    "/admin",
    "/api",
    "/onboarding",
    "/auth",
    "/rdv",
    "/invitation",
  ];
  return !prives.some(
    (prefixe) => chemin === prefixe || chemin.startsWith(`${prefixe}/`),
  );
}
