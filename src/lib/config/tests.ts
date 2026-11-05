import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { reglages, secret } from "./platform";

/**
 * Tests de connexion aux fournisseurs.
 *
 * ## Ce qu'un test prouve, et ce qu'il ne prouve pas
 *
 * Cinq choses différentes se confondent sous le mot « ça marche » :
 *
 * 1. la configuration est complète — on a les champs ;
 * 2. les identifiants sont présents — ils ne sont pas vides ;
 * 3. les identifiants sont valides — le fournisseur les accepte ;
 * 4. le service est joignable — il répond ;
 * 5. une opération métier a réussi — un vrai appel, un vrai SMS.
 *
 * **Ces tests prouvent 3 et 4.** Jamais 5. Un compte SMS valide ne garantit
 * pas qu'un message arrivera sur un téléphone belge ; seul un vrai envoi le
 * dirait, et un vrai envoi coûte de l'argent et dérange quelqu'un.
 *
 * L'écran de santé continue donc de distinguer le test de connexion de
 * l'échange métier réel.
 *
 * ## Non destructifs
 *
 * Chaque test est une lecture. Aucun n'envoie de SMS, ne passe d'appel ni ne
 * crée quoi que ce soit chez le fournisseur. Le seul qui consomme est celui de
 * l'IA — quelques centièmes de centime — et son coût est annoncé avant.
 *
 * ## La trace
 *
 * Chaque test écrit dans `integration_checks`. C'est ce qui donne à l'écran de
 * santé une preuve datée au lieu d'un « jamais exercé » qui ne veut rien dire.
 */

export interface ResultatTest {
  ok: boolean;
  message: string;
  /** Ce que le test a réellement vérifié, pour ne pas laisser croire davantage. */
  portee: string;
}

async function consigner(cle: string, resultat: ResultatTest): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc("record_integration_check", {
      cle,
      issue: resultat.ok ? "OK" : "FAIL",
      message: resultat.message.slice(0, 400),
      origine: "MANUAL",
    });
  } catch {
    /* une trace ratée ne change pas le résultat du test */
  }
}

/** Délai court : un fournisseur qui met dix secondes à répondre est un problème. */
async function appeler(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
}

async function testerAI(): Promise<ResultatTest> {
  const config = await reglages("ai", {
    provider: process.env.AI_PROVIDER?.trim().toLowerCase() || "mock",
    model: process.env.AI_MODEL?.trim() || "gpt-4.1-mini",
    base_url: process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1",
  });

  if (String(config.provider) === "mock") {
    return {
      ok: false,
      message:
        "Le fournisseur est réglé sur Simulation : il n’y a rien à joindre.",
      portee: "configuration",
    };
  }

  const cle = await secret("ai", "api_key", "AI_API_KEY");
  if (!cle) {
    return {
      ok: false,
      message: "Aucune clé API enregistrée.",
      portee: "configuration",
    };
  }

  try {
    // Une fausse transcription, courte, écrite ici. Jamais celle d'un vrai
    // client : son contenu appartient à l'artisan et à son appelant, et un
    // test n'est pas une raison de l'envoyer à un fournisseur.
    const reponse = await appeler(
      `${String(config.base_url)}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${cle}`,
        },
        body: JSON.stringify({
          model: String(config.model),
          max_tokens: 20,
          messages: [
            {
              role: "user",
              content:
                "Résume en une phrase : « Bonjour, je m'appelle Jean Test, j'ai une fuite sous l'évier. »",
            },
          ],
        }),
      },
    );

    if (!reponse.ok) {
      const texte = (await reponse.text()).slice(0, 200);
      return {
        ok: false,
        message: `Le fournisseur a répondu ${reponse.status}. ${texte}`,
        portee: "identifiants",
      };
    }

    return {
      ok: true,
      message: `${String(config.provider)} a répondu avec le modèle ${String(config.model)}.`,
      portee: "identifiants valides et service joignable",
    };
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Service injoignable.",
      portee: "service joignable",
    };
  }
}

async function testerVoice(): Promise<ResultatTest> {
  const config = await reglages("voice", {
    base_url: process.env.VOICE_API_BASE_URL?.trim() || "https://api.vapi.ai",
  });
  const cle = await secret("voice", "api_key", "VOICE_API_KEY");

  if (!cle) {
    return {
      ok: false,
      message: "Aucune clé API enregistrée.",
      portee: "configuration",
    };
  }

  try {
    // Lecture seule : la liste des assistants. Aucun appel n'est passé.
    const reponse = await appeler(
      `${String(config.base_url)}/assistant?limit=1`,
      {
        headers: { authorization: `Bearer ${cle}` },
      },
    );

    if (reponse.status === 401 || reponse.status === 403) {
      return {
        ok: false,
        message:
          "Clé refusée. Vérifiez qu’elle correspond bien à la région choisie : une clé américaine envoyée au serveur européen est refusée comme une clé fausse.",
        portee: "identifiants",
      };
    }

    if (!reponse.ok) {
      return {
        ok: false,
        message: `Le fournisseur a répondu ${reponse.status}.`,
        portee: "service joignable",
      };
    }

    const liste = (await reponse.json()) as unknown[];
    const nombre = Array.isArray(liste) ? liste.length : 0;
    return {
      ok: true,
      message:
        nombre > 0
          ? "Clé acceptée, au moins un assistant existe."
          : "Clé acceptée, mais aucun assistant n’est encore créé.",
      portee: "identifiants valides et service joignable",
    };
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Service injoignable.",
      portee: "service joignable",
    };
  }
}

async function testerMessaging(): Promise<ResultatTest> {
  const sid = await secret("messaging", "account_sid", "MESSAGING_ACCOUNT_SID");
  const token = await secret("messaging", "api_key", "MESSAGING_API_KEY");

  if (!sid || !token) {
    return {
      ok: false,
      message: "Identifiant de compte ou jeton manquant.",
      portee: "configuration",
    };
  }

  try {
    // Lecture de la fiche du compte : gratuit, et aucun message n'est envoyé.
    const reponse = await appeler(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`,
      {
        headers: {
          authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        },
      },
    );

    if (reponse.status === 401) {
      return {
        ok: false,
        message: "Identifiants refusés.",
        portee: "identifiants",
      };
    }

    if (!reponse.ok) {
      return {
        ok: false,
        message: `L’opérateur a répondu ${reponse.status}.`,
        portee: "service joignable",
      };
    }

    const compte = (await reponse.json()) as {
      status?: string;
      friendly_name?: string;
    };
    return {
      ok: compte.status === "active",
      message:
        compte.status === "active"
          ? `Compte « ${compte.friendly_name ?? "sans nom"} » actif. Aucun SMS n’a été envoyé.`
          : `Le compte existe mais son état est « ${compte.status ?? "inconnu"} ».`,
      portee: "identifiants valides et compte actif",
    };
  } catch (cause) {
    return {
      ok: false,
      message:
        cause instanceof Error ? cause.message : "Opérateur injoignable.",
      portee: "service joignable",
    };
  }
}

async function testerSupabase(): Promise<ResultatTest> {
  try {
    const admin = createAdminClient();
    const { error, count } = await admin
      .from("organizations")
      .select("id", { count: "exact", head: true });

    if (error) {
      return { ok: false, message: error.message, portee: "service joignable" };
    }

    return {
      ok: true,
      message: `Base joignable, ${count ?? 0} entreprise${(count ?? 0) > 1 ? "s" : ""}.`,
      portee: "service joignable et lecture autorisée",
    };
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Base injoignable.",
      portee: "service joignable",
    };
  }
}

async function testerCalendar(): Promise<ResultatTest> {
  const config = await reglages("google-calendar", {
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "",
  });
  const clientId = String(config.client_id ?? "");
  const clientSecret = await secret(
    "google-calendar",
    "client_secret",
    "GOOGLE_OAUTH_CLIENT_SECRET",
  );

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      message: "Identifiant ou secret OAuth manquant.",
      portee: "configuration",
    };
  }

  try {
    // On demande volontairement un jeton avec un code invalide. Google répond
    // `invalid_grant` si l'application est reconnue, et `invalid_client` si
    // elle ne l'est pas. C'est la seule vérification possible sans déranger
    // l'agenda de quelqu'un.
    const reponse = await appeler("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: "verification-de-configuration",
        redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "",
      }).toString(),
    });

    const corps = (await reponse.json()) as { error?: string };

    if (corps.error === "invalid_client") {
      return {
        ok: false,
        message:
          "Google ne reconnaît pas cet identifiant client, ou le secret est faux.",
        portee: "identifiants",
      };
    }

    return {
      ok: true,
      message:
        "Google reconnaît l’application. Cela ne dit rien des agendas des artisans : chacun connecte le sien depuis son espace.",
      portee: "identifiants de l’application acceptés",
    };
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Google injoignable.",
      portee: "service joignable",
    };
  }
}

const TESTS: Record<string, () => Promise<ResultatTest>> = {
  ai: testerAI,
  voice: testerVoice,
  messaging: testerMessaging,
  supabase: testerSupabase,
  "google-calendar": testerCalendar,
};

export function testExiste(cle: string): boolean {
  return cle in TESTS;
}

export async function testerFournisseur(cle: string): Promise<ResultatTest> {
  const test = TESTS[cle];

  if (!test) {
    return {
      ok: false,
      message: "Aucun test n’existe pour ce fournisseur.",
      portee: "aucune",
    };
  }

  const resultat = await test();
  await consigner(cle, resultat);
  return resultat;
}
