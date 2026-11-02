/**
 * Les instructions de renvoi d'appel, par pays.
 *
 * Ces codes sont ceux du réseau mobile (GSM), pas ceux d'un opérateur en
 * particulier. Ils fonctionnent chez la plupart des opérateurs belges et
 * français, et ils se composent depuis le téléphone comme un numéro.
 *
 * Deux renvois existent, et la différence compte pour un artisan :
 * - inconditionnel : tous les appels partent chez Sophie, le téléphone ne
 *   sonne pas ;
 * - sur non-réponse : le téléphone sonne d'abord, Sophie prend le relais si
 *   personne ne décroche.
 *
 * Le second est presque toujours le bon pour commencer : l'artisan garde la
 * main, et Sophie ne répond qu'à ce qu'il laisse passer.
 */

export type ModeConnexion = "FORWARD" | "DIRECT" | "PORTED";

export interface InstructionRenvoi {
  titre: string;
  code: string;
  explication: string;
}

export function instructionsRenvoi(
  numeroSophie: string,
  pays = "BE",
): InstructionRenvoi[] {
  const numero = numeroSophie.replace(/\s+/g, "");

  const commun: InstructionRenvoi[] = [
    {
      titre: "Si vous ne répondez pas",
      code: `**61*${numero}*11*20#`,
      explication:
        "Votre téléphone sonne vingt secondes. Si vous ne décrochez pas, l’appel part chez Sophie. C’est le réglage conseillé pour commencer.",
    },
    {
      titre: "Si vous êtes occupé ou injoignable",
      code: `**67*${numero}#`,
      explication:
        "L’appel part chez Sophie quand votre ligne est occupée, éteinte ou sans réseau.",
    },
    {
      titre: "Tous les appels, sans sonner",
      code: `**21*${numero}#`,
      explication:
        "Votre téléphone ne sonne plus du tout. À réserver aux journées où vous ne voulez pas être dérangé.",
    },
    {
      titre: "Tout annuler",
      code: "##002#",
      explication: "Supprime tous les renvois. Votre téléphone redevient normal.",
    },
  ];

  if (pays === "FR") {
    return commun.map((instruction) =>
      instruction.titre === "Tout annuler"
        ? instruction
        : { ...instruction, explication: `${instruction.explication} (code valable chez la plupart des opérateurs français)` },
    );
  }

  return commun;
}

export const MODES: { cle: ModeConnexion; libelle: string; detail: string }[] = [
  {
    cle: "FORWARD",
    libelle: "Je garde mon numéro et je le renvoie",
    detail:
      "Vos clients continuent d’appeler votre numéro habituel. Vous le renvoyez vers le numéro de Sophie. C’est le mode conseillé : rien ne change pour vos clients.",
  },
  {
    cle: "DIRECT",
    libelle: "Je donne le numéro de Sophie à mes clients",
    detail:
      "Vous communiquez directement le numéro de Sophie, par exemple sur un site ou une annonce. Votre numéro personnel reste privé.",
  },
  {
    cle: "PORTED",
    libelle: "J’ai transféré mon numéro chez l’opérateur de Sophie",
    detail:
      "Votre numéro historique a été porté. Il n’y a plus de renvoi à faire, mais la portabilité se demande auprès de l’opérateur et prend plusieurs jours.",
  },
];
