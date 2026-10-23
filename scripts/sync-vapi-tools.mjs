#!/usr/bin/env node
/**
 * Déclare les outils de Sophie chez le fournisseur de voix.
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * Le modèle ne peut appeler que les outils déclarés chez le fournisseur. Les
 * recopier à la main dans sept formulaires web est long, et surtout c'est ainsi
 * qu'ils divergent du code : un paramètre renommé d'un côté et pas de l'autre,
 * et Sophie appelle un outil avec des arguments que le serveur ne comprend
 * plus. L'erreur est alors invisible — elle ne se voit qu'au téléphone.
 *
 * Le catalogue est lu depuis le serveur RÉELLEMENT DÉPLOYÉ, et non depuis le
 * code local : si votre machine est en avance sur la production, c'est la
 * production qui a raison, puisque c'est elle qui répondra aux appels.
 *
 * USAGE
 *
 *   node --env-file=.env.local scripts/sync-vapi-tools.mjs
 *   node --env-file=.env.local scripts/sync-vapi-tools.mjs --apply
 *
 * Sans `--apply`, le script n'écrit RIEN : il montre ce qu'il ferait. C'est le
 * mode par défaut à dessein — un script qui modifie un service externe dès la
 * première exécution est un script qu'on lance une fois de trop.
 *
 * VARIABLES ATTENDUES dans .env.local
 *
 *   VOICE_API_KEY          clé privée du tableau de bord Vapi
 *   VOICE_WEBHOOK_SECRET   le même secret que dans Vercel
 *   NEXT_PUBLIC_APP_URL    https://zelicall.com
 *   SOPHIE_ORG_ID          identifiant de l'organisation
 *   VOICE_ASSISTANT_ID     facultatif : rattache les outils à cet assistant
 *
 * Aucune de ces valeurs n'est affichée par le script.
 */

const API = (process.env.VOICE_API_BASE_URL || "https://api.vapi.ai").replace(/\/$/, "");
const APPLIQUER = process.argv.includes("--apply");

const requis = ["VOICE_API_KEY", "VOICE_WEBHOOK_SECRET", "NEXT_PUBLIC_APP_URL", "SOPHIE_ORG_ID"];
const manquantes = requis.filter((nom) => !process.env[nom]?.trim());

if (manquantes.length > 0) {
  console.error(`Variables manquantes dans .env.local : ${manquantes.join(", ")}`);
  console.error("Le script ne devine rien : il s'arrête.");
  process.exit(1);
}

const CLE = process.env.VOICE_API_KEY.trim();
const SECRET = process.env.VOICE_WEBHOOK_SECRET.trim();
const BASE = process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");
const ORG = process.env.SOPHIE_ORG_ID.trim();
const ASSISTANT = process.env.VOICE_ASSISTANT_ID?.trim() || null;

const URL_OUTILS = `${BASE}/api/voice/tools?org=${ORG}`;

async function vapi(chemin, options = {}) {
  const reponse = await fetch(`${API}${chemin}`, {
    ...options,
    headers: {
      authorization: `Bearer ${CLE}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });

  const texte = await reponse.text();

  if (!reponse.ok) {
    if (reponse.status === 401) {
      // « unauthorized » tout court ne dit rien, et la cause la plus fréquente
      // n'est pas la clé : c'est la région. Une clé américaine envoyée au
      // serveur européen est refusée exactement comme une clé fausse.
      throw new Error(
        `Le fournisseur a refusé la clé (401).\n\n` +
          `Adresse utilisée : ${API}\n\n` +
          `Deux causes possibles, dans cet ordre :\n` +
          `  1. VOICE_API_BASE_URL ne correspond pas à votre compte.\n` +
          `     Compte américain → https://api.vapi.ai\n` +
          `     Compte européen  → https://api.eu.vapi.ai\n` +
          `  2. VOICE_API_KEY n'est pas une clé privée, ou a été copiée masquée.\n` +
          `     Utilisez le bouton copier du tableau de bord, pas la souris.`,
      );
    }

    // Le corps de la réponse porte la vraie raison. L'afficher évite la séance
    // de devinettes qu'impose un simple « 400 Bad Request ».
    throw new Error(`${options.method || "GET"} ${chemin} → ${reponse.status}\n${texte}`);
  }

  return texte ? JSON.parse(texte) : null;
}

async function catalogue() {
  const reponse = await fetch(`${BASE}/api/voice/tools/manifest`, {
    headers: { "x-vapi-secret": SECRET },
  });

  if (reponse.status === 401) {
    throw new Error(
      "Le serveur a refusé le secret. VOICE_WEBHOOK_SECRET doit être identique\n" +
        "dans .env.local et dans les variables Vercel du déploiement en cours.",
    );
  }

  if (!reponse.ok) {
    throw new Error(`Catalogue indisponible : ${reponse.status} ${await reponse.text()}`);
  }

  const { tools, analysisPlan } = await reponse.json();
  return { tools, analysisPlan };
}

function corpsOutil(definition) {
  return {
    type: "function",
    function: {
      name: definition.name,
      description: definition.description,
      parameters: definition.parameters,
    },
    server: {
      url: URL_OUTILS,
      timeoutSeconds: 20,
      headers: { "x-vapi-secret": SECRET },
    },
  };
}

async function main() {
  console.log(APPLIQUER ? "Mode : écriture réelle" : "Mode : simulation (ajoutez --apply pour écrire)");
  console.log(`Fournisseur de voix : ${API}`);
  console.log(`Serveur d'outils    : ${URL_OUTILS}\n`);

  const { tools: attendus, analysisPlan } = await catalogue();
  console.log(`${attendus.length} outils déclarés par le serveur.`);
  console.log(
    analysisPlan
      ? "Plan d'analyse (résumé + extraction) : fourni par le serveur.\n"
      : "Plan d'analyse : ABSENT du manifeste. Le résumé restera vide.\n",
  );

  const existants = await vapi("/tool");
  const parNom = new Map(
    (Array.isArray(existants) ? existants : []).map((o) => [o.function?.name, o]),
  );

  const ids = [];
  let crees = 0;
  let majs = 0;

  for (const definition of attendus) {
    const existant = parNom.get(definition.name);
    const corps = corpsOutil(definition);

    if (!existant) {
      if (APPLIQUER) {
        const cree = await vapi("/tool", { method: "POST", body: JSON.stringify(corps) });
        ids.push(cree.id);
      }
      crees += 1;
      console.log(`  + ${definition.name}`);
      continue;
    }

    ids.push(existant.id);

    if (APPLIQUER) {
      await vapi(`/tool/${existant.id}`, { method: "PATCH", body: JSON.stringify(corps) });
    }
    majs += 1;
    console.log(`  ~ ${definition.name}`);
  }

  console.log(`\n${crees} à créer, ${majs} à mettre à jour.`);

  if (ASSISTANT) {
    // Ce que l'assistant porte AVANT toute écriture. Sans cette lecture, on ne
    // peut pas distinguer « mon réglage n'a jamais été écrit » de « mon réglage
    // a été écrasé depuis ». Le 23 octobre, le rapport d'un appel a montré un
    // plan d'analyse désactivé alors que ce script l'avait déclaré actif
    // quelques minutes plus tôt : une sauvegarde faite dans le tableau de bord
    // renvoie l'assistant entier, réglages compris, et efface ce qu'on a poussé.
    const avant = await vapi(`/assistant/${ASSISTANT}`);
    console.log(
      `\nÉtat actuel de l'assistant : résumé ${
        avant?.analysisPlan?.summaryPlan?.enabled === true ? "ACTIF" : "INACTIF"
      }, extraction ${
        avant?.analysisPlan?.structuredDataPlan?.enabled === true ? "ACTIVE" : "INACTIVE"
      }, ${avant?.model?.toolIds?.length ?? 0} outils rattachés.`,
    );
    console.log(
      "Toute sauvegarde faite dans le tableau de bord Vapi écrase ces réglages.\n" +
        "Relancez ce script après chaque modification faite à la main.\n",
    );

    if (APPLIQUER) {
      // Vapi REMPLACE l'objet `model` au lieu de le fusionner : envoyer
      // seulement `toolIds` efface le modèle et le provider, et la requête est
      // refusée. On relit donc l'assistant et on renvoie son modèle complet.
      const modele = avant?.model;

      if (!modele?.provider) {
        throw new Error(
          `L'assistant ${ASSISTANT} n'a pas de modèle lisible.\n` +
            `Rattachez les outils à la main dans le tableau de bord.`,
        );
      }

      // On remplace la liste entière : un outil retiré du code doit disparaître
      // de l'assistant, sinon le modèle continuera de l'appeler dans le vide.
      //
      // Le plan d'analyse part dans la même requête. Sans lui, le fournisseur
      // renvoie un rapport dont le champ `summary` est vide : c'est ce qui a
      // été constaté sur le premier appel réel, et rien ne le signalait.
      const corpsAssistant = { model: { ...modele, toolIds: ids } };
      if (analysisPlan) corpsAssistant.analysisPlan = analysisPlan;

      await vapi(`/assistant/${ASSISTANT}`, {
        method: "PATCH",
        body: JSON.stringify(corpsAssistant),
      });

      // On relit pour constater, au lieu d'annoncer un succès sur la foi d'un
      // code HTTP. Un PATCH accepté qui n'a rien changé est déjà arrivé.
      const apres = await vapi(`/assistant/${ASSISTANT}`);
      const resumeActif = apres?.analysisPlan?.summaryPlan?.enabled === true;
      const outilsRattaches = apres?.model?.toolIds?.length ?? 0;

      console.log(`Assistant ${ASSISTANT} : ${outilsRattaches} outils rattachés.`);
      console.log(
        resumeActif
          ? "Résumé et extraction : activés et vérifiés sur l'assistant."
          : "ATTENTION : le plan d'analyse n'est pas actif après écriture. Le résumé restera vide.",
      );
    } else {
      console.log(`Assistant ${ASSISTANT} : ${ids.length} outils seraient rattachés.`);
      console.log("Plan d'analyse : serait écrit sur l'assistant.");
    }
  } else {
    console.log(
      "VOICE_ASSISTANT_ID non renseignée : les outils ne sont rattachés à aucun assistant.\n" +
        "Ajoutez-la, ou rattachez-les à la main dans le tableau de bord.",
    );
  }

  if (!APPLIQUER) console.log("\nRien n'a été écrit. Relancez avec --apply.");
}

main().catch((erreur) => {
  console.error(`\n${erreur.message}`);
  process.exit(1);
});
