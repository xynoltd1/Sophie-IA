/**
 * Ce que le fournisseur doit produire APRÈS l'appel : un résumé et des champs
 * structurés (sections 15 et 16).
 *
 * Pourquoi ce fichier existe plutôt qu'un réglage dans un tableau de bord : le
 * premier appel réel a montré un rapport sans résumé. Le champ `summary`
 * existait, vide, et `analysis` ne contenait rien — l'analyse n'était pas
 * activée. Un réglage invisible, coché à la main, qui ne marche pas, personne
 * ne s'en aperçoit avant de lire une fiche d'appel vide.
 *
 * Ces instructions sont donc versionnées avec le code et poussées par
 * `npm run vapi:tools -- --apply`, comme les outils.
 *
 * ## La règle qui gouverne les deux instructions
 *
 * Ne rien inventer. Un champ qu'on n'a pas entendu reste absent. Un nom
 * inventé dans un CRM est pire qu'un nom manquant : il a l'air vrai, et
 * l'artisan appellera « monsieur Martin » quelqu'un qui ne s'appelle pas
 * Martin.
 */

const INTERDICTION =
  "Tu n'ajoutes jamais une information qui n'a pas été dite pendant l'appel. " +
  "Si tu ne connais pas une valeur, tu l'omets. Tu ne devines pas, tu ne complètes pas, " +
  "tu n'arrondis pas.";

/**
 * Le résumé est lu par un artisan sur un chantier, entre deux interventions.
 * Il doit répondre à une seule question : est-ce que je dois rappeler, et quoi
 * dire ? D'où la contrainte de longueur, et l'interdiction des formules.
 */
const RESUME_SYSTEME =
  "Tu résumes un appel téléphonique reçu par la secrétaire virtuelle d'un artisan. " +
  "Le lecteur est l'artisan lui-même, souvent sur un chantier, avec peu de temps. " +
  "Écris en français, à la troisième personne, trois phrases au maximum. " +
  "Dis qui a appelé, ce qu'il veut, et ce qui est attendu de l'artisan. " +
  "Pas de formule d'introduction, pas de « l'appelant a indiqué que ». " +
  INTERDICTION +
  " Si l'appel n'a pas de contenu — un raccrochage, un faux numéro — dis-le en une phrase.";

const DONNEES_SYSTEME =
  "Tu extrais des champs structurés d'un appel téléphonique reçu par la secrétaire " +
  "virtuelle d'un artisan. " +
  INTERDICTION +
  " Un champ absent vaut mieux qu'un champ faux : tout ce qui est écrit ici sera affiché " +
  "à l'artisan comme une information sûre.";

/**
 * Les champs de la section 15. Aucun n'est obligatoire, et c'est le point
 * central : un schéma qui exige une valeur pousse le modèle à en fabriquer une.
 */
const SCHEMA_DONNEES = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      description:
        "Ce que veut l'appelant, parmi : RENDEZ_VOUS, MODIFICATION, ANNULATION, DEVIS, " +
        "URGENCE, QUESTION_SERVICE, QUESTION_TARIF, RECLAMATION, SUIVI, MESSAGE, RAPPEL, " +
        "DEMARCHAGE, INCONNU.",
    },
    service: {
      type: "string",
      description: "Le service ou le type d'intervention demandé, dans les mots de l'appelant.",
    },
    urgency: {
      type: "string",
      description:
        "URGENTE si l'appelant décrit une situation qui ne peut pas attendre (fuite, panne " +
        "totale, danger), NORMALE sinon. En cas de doute, NORMALE.",
    },
    customer_name: { type: "string", description: "Nom de l'appelant, tel qu'il l'a donné." },
    address: {
      type: "string",
      description: "Adresse de l'intervention, uniquement si elle a été dictée.",
    },
    requested_date: {
      type: "string",
      description: "Date souhaitée au format AAAA-MM-JJ, uniquement si elle a été dite.",
    },
    requested_time: {
      type: "string",
      description: "Heure souhaitée au format HH:MM, uniquement si elle a été dite.",
    },
    problem_description: {
      type: "string",
      description: "Le problème décrit par l'appelant, dans ses mots, en une ou deux phrases.",
    },
    appointment_requested: {
      type: "boolean",
      description: "Vrai si l'appelant a demandé un rendez-vous.",
    },
    callback_requested: {
      type: "boolean",
      description: "Vrai si l'appelant a demandé à être rappelé.",
    },
  },
  required: [],
} as const;

/**
 * Le plan d'analyse, au format attendu par le fournisseur.
 *
 * `successEvaluationPlan` est désactivé volontairement : noter la « réussite »
 * d'un appel sur une échelle inventée par un modèle n'aide pas l'artisan et
 * produirait un chiffre que personne ne pourrait expliquer.
 */
export function analysisPlan() {
  return {
    summaryPlan: {
      enabled: true,
      timeoutSeconds: 30,
      messages: [
        { role: "system", content: RESUME_SYSTEME },
        {
          role: "user",
          content: "Voici la transcription de l'appel :\n\n{{transcript}}\n\nRésume-le.",
        },
      ],
    },
    structuredDataPlan: {
      enabled: true,
      timeoutSeconds: 30,
      schema: SCHEMA_DONNEES,
      messages: [
        { role: "system", content: DONNEES_SYSTEME },
        {
          role: "user",
          content:
            "Voici la transcription de l'appel :\n\n{{transcript}}\n\n" +
            "Extrais les champs demandés. Omets ceux dont tu n'as pas entendu la valeur.",
        },
      ],
    },
    successEvaluationPlan: { enabled: false },
  };
}

/** Les champs attendus, exposés pour les tests et l'affichage. */
export const CHAMPS_EXTRACTION = Object.keys(SCHEMA_DONNEES.properties);
