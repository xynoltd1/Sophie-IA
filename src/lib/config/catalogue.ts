/**
 * Ce qui se configure, en mots que comprend quelqu'un qui n'écrit pas de code.
 *
 * ## Pourquoi un catalogue déclaratif
 *
 * Les formulaires, l'écran de santé, les tests de connexion et la
 * documentation disaient chacun leur version de « ce dont ce fournisseur a
 * besoin ». Quatre listes à tenir d'accord, donc quatre occasions de
 * diverger. Ici, une seule.
 *
 * ## Le vocabulaire
 *
 * Chaque champ porte un libellé en français et une phrase d'aide qui dit à
 * quoi il sert. `AI_API_KEY` reste visible, mais dans un repli « avancé » :
 * c'est le nom dont on a besoin pour retrouver la variable sur Vercel, pas
 * celui qu'on lit pour comprendre.
 *
 * ## Les fournisseurs sans adaptateur
 *
 * Ils figurent dans la liste, marqués indisponibles, avec la raison. Les
 * cacher donnerait l'impression qu'ils n'existent pas ; les présenter comme
 * configurables donnerait un formulaire qui n'allume rien.
 */

export type Categorie =
  | "Téléphonie"
  | "Voix IA"
  | "Transcription"
  | "Résumé et extraction IA"
  | "SMS"
  | "E-mail"
  | "Calendriers"
  | "Stockage"
  | "Mesure"
  | "Paiement et abonnements";

export interface ChampConfig {
  cle: string;
  libelle: string;
  aide: string;
  /** Secret : chiffré en base, jamais réaffiché. Sinon : réglage en clair. */
  secret: boolean;
  /** Le nom technique, pour la section avancée et pour Vercel. */
  variableEnv?: string;
  type?: "texte" | "choix";
  options?: readonly { valeur: string; libelle: string }[];
  placeholder?: string;
}

export interface FournisseurConfig {
  cle: string;
  nom: string;
  categorie: Categorie;
  /** Ce que ça fait, en une phrase, sans jargon. */
  role: string;
  /** Faux : aucun adaptateur n'existe dans le code. */
  implemente: boolean;
  /** Pourquoi ce n'est pas disponible, quand ce ne l'est pas. */
  indisponible?: string;
  champs: readonly ChampConfig[];
  documentation?: string;
  /** Un test de connexion existe-t-il ? */
  testable: boolean;
  /** Ce que le test coûte, quand il coûte. */
  coutTest?: string;
  /** Réglé ailleurs que dans ce formulaire. */
  note?: string;
}

export const CATALOGUE: readonly FournisseurConfig[] = [
  {
    cle: "ai",
    nom: "Résumé et extraction après appel",
    categorie: "Résumé et extraction IA",
    role: "Produit le résumé de chaque appel et en extrait le nom, l’adresse et le problème.",
    implemente: true,
    testable: true,
    coutTest:
      "Le test envoie une fausse transcription de trois lignes. Quelques centièmes de centime.",
    documentation: "https://docs.mistral.ai/",
    champs: [
      {
        cle: "provider",
        libelle: "Fournisseur",
        aide: "Mistral est européen : les transcriptions ne quittent pas l’Europe.",
        secret: false,
        variableEnv: "AI_PROVIDER",
        type: "choix",
        options: [
          { valeur: "mock", libelle: "Simulation (aucun appel réel)" },
          { valeur: "mistral", libelle: "Mistral — Europe" },
          { valeur: "openai", libelle: "OpenAI — États-Unis" },
        ],
      },
      {
        cle: "api_key",
        libelle: "Clé API",
        aide: "Elle permet à Zeli de rédiger les résumés. Elle n’est jamais réaffichée après enregistrement.",
        secret: true,
        variableEnv: "AI_API_KEY",
        placeholder: "sk-…",
      },
      {
        cle: "model",
        libelle: "Modèle",
        aide: "Un petit modèle suffit pour résumer un appel, et coûte dix fois moins cher.",
        secret: false,
        variableEnv: "AI_MODEL",
        placeholder: "mistral-small-latest",
      },
      {
        cle: "base_url",
        libelle: "Adresse de l’API",
        aide: "À changer seulement si vous utilisez un service compatible autre que celui prévu.",
        secret: false,
        variableEnv: "AI_BASE_URL",
        placeholder: "https://api.mistral.ai/v1",
      },
    ],
  },
  {
    cle: "voice",
    nom: "Zeli Voice",
    categorie: "Voix IA",
    role: "Répond au téléphone, parle avec le client et appelle les outils de l’application.",
    implemente: true,
    testable: true,
    coutTest:
      "Gratuit : le test lit la liste de vos assistants, il n’appelle personne.",
    documentation: "https://docs.vapi.ai/",
    note: "La voix, la langue et le texte d’accueil se règlent chez le fournisseur. Le secret de signature des webhooks reste dans l’environnement : il protège l’entrée, il ne peut pas être réglé depuis l’intérieur.",
    champs: [
      {
        cle: "api_key",
        libelle: "Clé API privée",
        aide: "Elle autorise l’application à déclarer les outils de Zeli chez le fournisseur.",
        secret: true,
        variableEnv: "VOICE_API_KEY",
      },
      {
        cle: "base_url",
        libelle: "Région du compte",
        aide: "Une clé américaine envoyée au serveur européen est refusée exactement comme une clé fausse.",
        secret: false,
        variableEnv: "VOICE_API_BASE_URL",
        type: "choix",
        options: [
          { valeur: "https://api.vapi.ai", libelle: "États-Unis" },
          {
            valeur: "https://api.eu.vapi.ai",
            libelle: "Europe (contrats Premier)",
          },
        ],
      },
      {
        cle: "assistant_id",
        libelle: "Identifiant de l’assistant",
        aide: "L’assistant auquel rattacher les outils. Visible dans le tableau de bord du fournisseur.",
        secret: false,
      },
    ],
  },
  {
    cle: "messaging",
    nom: "SMS",
    categorie: "SMS",
    role: "Envoie les confirmations, refus et annulations de rendez-vous aux clients.",
    implemente: true,
    testable: true,
    coutTest:
      "Gratuit : le test vérifie que les identifiants ouvrent bien le compte. Il n’envoie aucun SMS.",
    documentation: "https://www.twilio.com/docs/messaging",
    champs: [
      {
        cle: "provider",
        libelle: "Opérateur",
        aide: "Seul Twilio a un adaptateur dans le code aujourd’hui.",
        secret: false,
        variableEnv: "MESSAGING_PROVIDER",
        type: "choix",
        options: [
          { valeur: "mock", libelle: "Simulation (rien n’est envoyé)" },
          { valeur: "twilio", libelle: "Twilio" },
        ],
      },
      {
        cle: "account_sid",
        libelle: "Identifiant du compte",
        aide: "Le SID du compte, visible sur la page d’accueil de la console de l’opérateur.",
        secret: true,
        variableEnv: "MESSAGING_ACCOUNT_SID",
        placeholder: "AC…",
      },
      {
        cle: "api_key",
        libelle: "Jeton d’authentification",
        aide: "Il donne le droit d’envoyer des SMS facturés sur votre compte. Jamais réaffiché.",
        secret: true,
        variableEnv: "MESSAGING_API_KEY",
      },
      {
        cle: "sender_id",
        libelle: "Expéditeur",
        aide: "Un numéro au format +32… permet au client de répondre. Un nom comme SOPHIE ne le permet pas, et est interdit dans certains pays.",
        secret: false,
        variableEnv: "MESSAGING_SENDER_ID",
        placeholder: "+32…",
      },
    ],
  },
  {
    cle: "supabase",
    nom: "Base de données, comptes et stockage",
    categorie: "Stockage",
    role: "Contient toutes les données du produit et gère les connexions.",
    implemente: true,
    testable: true,
    coutTest: "Gratuit : le test compte les entreprises, rien d’autre.",
    note: "Ces clés ne sont pas réglables ici, et ce n’est pas une précaution : la clé qui lit la base ne peut pas être rangée dans la base, et la clé qui déchiffre les secrets ne peut pas être rangée avec eux. Elles restent dans l’environnement.",
    champs: [],
  },
  {
    cle: "google-calendar",
    nom: "Google Agenda",
    categorie: "Calendriers",
    role: "Lit les disponibilités réelles de chaque artisan et y écrit les rendez-vous confirmés.",
    implemente: true,
    testable: true,
    coutTest:
      "Gratuit : le test vérifie que l’identifiant OAuth est accepté par Google.",
    documentation: "https://developers.google.com/calendar",
    note: "Chaque artisan connecte son propre agenda depuis son espace. Ses jetons ne sont jamais visibles ici : ils ouvrent son agenda personnel, et l’éditeur du logiciel n’a aucune raison d’y accéder.",
    champs: [
      {
        cle: "client_id",
        libelle: "Identifiant client OAuth",
        aide: "Fourni par la console Google Cloud, pour une application de type Web.",
        secret: false,
        variableEnv: "GOOGLE_OAUTH_CLIENT_ID",
      },
      {
        cle: "client_secret",
        libelle: "Secret client OAuth",
        aide: "Le mot de passe de l’application auprès de Google. Jamais réaffiché.",
        secret: true,
        variableEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
      },
    ],
  },
  {
    cle: "analytics",
    nom: "Mesure de fréquentation",
    categorie: "Mesure",
    role: "Compte les visites du site public, sans cookie et sans traceur.",
    implemente: true,
    testable: false,
    champs: [
      {
        cle: "enabled",
        libelle: "Mesurer la fréquentation",
        aide: "Désactivée, la collecte s’arrête : plus aucune visite n’est enregistrée.",
        secret: false,
        type: "choix",
        options: [
          { valeur: "true", libelle: "Activée" },
          { valeur: "false", libelle: "Désactivée" },
        ],
      },
      {
        cle: "exclude_internal",
        libelle: "Exclure vos propres visites",
        aide: "Les pages privées ne sont jamais comptées. Ce réglage écarte en plus les visites du site public faites depuis un compte connecté.",
        secret: false,
        type: "choix",
        options: [
          { valeur: "true", libelle: "Exclure" },
          { valeur: "false", libelle: "Compter" },
        ],
      },
    ],
  },
  {
    cle: "telephony",
    nom: "Opérateur téléphonique",
    categorie: "Téléphonie",
    role: "Fournit le numéro sur lequel les clients appellent.",
    implemente: false,
    indisponible:
      "Aucun adaptateur d’opérateur n’existe dans le code, et c’est voulu : le son d’un appel ne passe jamais par l’application (ADR-002). C’est le fournisseur de voix qui reçoit l’appel. Un numéro se rattache donc à votre assistant vocal, pas ici — et se déclare ensuite dans l’espace de l’entreprise.",
    testable: false,
    champs: [],
  },
  {
    cle: "transcription",
    nom: "Transcription des appels",
    categorie: "Transcription",
    role: "Transforme ce qui est dit pendant l’appel en texte.",
    implemente: true,
    testable: false,
    note: "Produite par le fournisseur de voix, avec sa clé. Il n’y a rien à configurer séparément. La qualité en français reste perfectible : noms propres et numéros dictés sont souvent mal entendus.",
    champs: [],
  },
  {
    cle: "email",
    nom: "E-mails transactionnels",
    categorie: "E-mail",
    role: "Enverrait les invitations d’équipe et les messages du produit.",
    implemente: false,
    indisponible:
      "Aucun adaptateur n’est écrit. Aujourd’hui, une invitation d’équipe s’affiche sous forme de lien à transmettre à la main. Le développement est court une fois le service choisi.",
    testable: false,
    champs: [],
  },
  {
    cle: "payment",
    nom: "Paiement et abonnements",
    categorie: "Paiement et abonnements",
    role: "Encaisserait les abonnements des entreprises clientes.",
    implemente: false,
    indisponible:
      "Aucun paiement n’est branché. Trois décisions vous appartiennent avant qu’on écrive la moindre ligne : vos prix, le prestataire, et le modèle — abonnement fixe ou abonnement plus consommation.",
    testable: false,
    champs: [],
  },
] as const;

export function fournisseur(cle: string): FournisseurConfig | undefined {
  return CATALOGUE.find((f) => f.cle === cle);
}

export const CATEGORIES: readonly Categorie[] = [
  "Voix IA",
  "Téléphonie",
  "Transcription",
  "Résumé et extraction IA",
  "SMS",
  "Calendriers",
  "Stockage",
  "Mesure",
  "E-mail",
  "Paiement et abonnements",
] as const;
