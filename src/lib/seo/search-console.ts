import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { reglages, secret } from "@/lib/config/platform";

/**
 * Google Search Console.
 *
 * ## Pourquoi cette connexion existe
 *
 * Les positions dans Google, les impressions et les mots tapés par les
 * visiteurs ne viennent que de là. Aucun outil ne les reconstitue, et notre
 * propre mesure de fréquentation ne les remplace pas : elle compte des visites
 * reçues, pas des apparitions dans les résultats.
 *
 * ## Le périmètre demandé
 *
 * Une seule autorisation, en lecture seule, sur les propriétés Search Console.
 * Rien sur l'agenda, rien sur la boîte mail, rien d'autre. Demander plus
 * rallongerait la vérification de l'application Google et exposerait des
 * données qu'on n'utilise pas.
 *
 * ## Ce qui est stocké
 *
 * Le jeton de rafraîchissement, chiffré, dans une table sans aucune permission
 * de lecture. Le jeton d'accès, lui, n'est jamais stocké : il vit une heure et
 * se redemande.
 *
 * ## Ce que cette connexion ne fait pas
 *
 * Elle ne vérifie pas la propriété du site et ne dépose pas le plan du site.
 * L'API ne le permet pas sans un périmètre d'écriture bien plus large, et ces
 * deux gestes se font une fois, à la main, dans Search Console. Les demander
 * en permanence pour deux clics serait disproportionné.
 */

const PORTEE = "https://www.googleapis.com/auth/webmasters.readonly";
const AUTORISATION = "https://accounts.google.com/o/oauth2/v2/auth";
const JETON = "https://oauth2.googleapis.com/token";
const API = "https://searchconsole.googleapis.com/webmasters/v3";

export interface EtatSearchConsole {
  connecte: boolean;
  propriete: string | null;
  connecteLe: string | null;
  derniereErreur: string | null;
}

async function identifiants(): Promise<{ id: string; secret: string } | null> {
  const config = await reglages("google-calendar", {
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "",
  });
  const id = String(config.client_id ?? "").trim();
  const cle = await secret(
    "google-calendar",
    "client_secret",
    "GOOGLE_OAUTH_CLIENT_SECRET",
  );

  if (!id || !cle) return null;
  return { id, secret: cle };
}

export async function searchConsoleConfigurable(): Promise<boolean> {
  return (await identifiants()) !== null;
}

/** L'adresse de retour. Elle doit être déclarée à l'identique dans Google Cloud. */
export function adresseRetour(origine: string): string {
  return `${origine}/api/integrations/search-console/callback`;
}

export async function urlAutorisation(
  origine: string,
  state: string,
): Promise<string | null> {
  const ids = await identifiants();
  if (!ids) return null;

  const parametres = new URLSearchParams({
    client_id: ids.id,
    redirect_uri: adresseRetour(origine),
    response_type: "code",
    scope: PORTEE,
    // Sans `offline`, Google ne renvoie pas de jeton de rafraîchissement et la
    // connexion meurt au bout d'une heure.
    access_type: "offline",
    // Sans `consent`, Google ne renvoie le jeton de rafraîchissement qu'à la
    // toute première autorisation : une reconnexion donnerait une connexion
    // qui marche une heure puis s'éteint sans raison apparente.
    prompt: "consent",
    state,
  });

  return `${AUTORISATION}?${parametres.toString()}`;
}

export async function echangerCode(
  code: string,
  origine: string,
  actorUserId: string,
): Promise<{ ok: boolean; erreur?: string }> {
  const ids = await identifiants();
  if (!ids) return { ok: false, erreur: "Identifiants OAuth absents." };

  try {
    const reponse = await fetch(JETON, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: ids.id,
        client_secret: ids.secret,
        redirect_uri: adresseRetour(origine),
        grant_type: "authorization_code",
      }).toString(),
      signal: AbortSignal.timeout(10_000),
    });

    const corps = (await reponse.json()) as {
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!reponse.ok || !corps.refresh_token) {
      return {
        ok: false,
        erreur:
          corps.error_description ??
          corps.error ??
          "Google n’a pas renvoyé de jeton de rafraîchissement.",
      };
    }

    const admin = createAdminClient();
    await admin.from("search_console_connection").upsert(
      {
        id: true,
        refresh_token: encryptSecret(corps.refresh_token),
        connected_at: new Date().toISOString(),
        connected_by: actorUserId,
        last_error: null,
      },
      { onConflict: "id" },
    );

    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      erreur: cause instanceof Error ? cause.message : "Échange impossible.",
    };
  }
}

/** Un jeton d'accès frais. Jamais stocké : il vit une heure. */
async function jetonAcces(): Promise<string | null> {
  const ids = await identifiants();
  if (!ids) return null;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("search_console_connection")
      .select("refresh_token")
      .eq("id", true)
      .maybeSingle();

    if (!data?.refresh_token) return null;

    const reponse = await fetch(JETON, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: ids.id,
        client_secret: ids.secret,
        refresh_token: decryptSecret(data.refresh_token as string),
        grant_type: "refresh_token",
      }).toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!reponse.ok) {
      await noterErreur(
        "Google a refusé le jeton de rafraîchissement. Reconnectez Search Console.",
      );
      return null;
    }

    const corps = (await reponse.json()) as { access_token?: string };
    return corps.access_token ?? null;
  } catch {
    return null;
  }
}

async function noterErreur(message: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from("search_console_connection")
      .update({ last_error: message.slice(0, 400) })
      .eq("id", true);
  } catch {
    /* sans effet */
  }
}

export async function etatSearchConsole(): Promise<EtatSearchConsole> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("search_console_connection")
      .select("property, connected_at, last_error")
      .eq("id", true)
      .maybeSingle();

    if (!data) {
      return {
        connecte: false,
        propriete: null,
        connecteLe: null,
        derniereErreur: null,
      };
    }

    return {
      connecte: true,
      propriete: (data.property as string | null) ?? null,
      connecteLe: (data.connected_at as string | null) ?? null,
      derniereErreur: (data.last_error as string | null) ?? null,
    };
  } catch {
    return {
      connecte: false,
      propriete: null,
      connecteLe: null,
      derniereErreur: null,
    };
  }
}

export async function deconnecter(): Promise<void> {
  const admin = createAdminClient();
  await admin.from("search_console_connection").delete().eq("id", true);
}

export async function proprietes(): Promise<string[]> {
  const jeton = await jetonAcces();
  if (!jeton) return [];

  try {
    const reponse = await fetch(`${API}/sites`, {
      headers: { authorization: `Bearer ${jeton}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!reponse.ok) return [];

    const corps = (await reponse.json()) as {
      siteEntry?: { siteUrl: string; permissionLevel: string }[];
    };

    return (corps.siteEntry ?? [])
      .filter((entree) => entree.permissionLevel !== "siteUnverifiedUser")
      .map((entree) => entree.siteUrl);
  } catch {
    return [];
  }
}

export async function choisirPropriete(propriete: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("search_console_connection")
    .update({ property: propriete, last_error: null })
    .eq("id", true);
}

export interface PerformanceRecherche {
  clics: number;
  impressions: number;
  ctr: number;
  position: number;
  requetes: {
    valeur: string;
    clics: number;
    impressions: number;
    position: number;
  }[];
  pages: {
    valeur: string;
    clics: number;
    impressions: number;
    position: number;
  }[];
}

/**
 * Les chiffres de recherche.
 *
 * Google ne publie rien avant deux à trois jours : demander hier renvoie
 * presque toujours zéro. La fenêtre s'arrête donc trois jours avant
 * aujourd'hui, et l'écran le dit — sinon on croit à une panne.
 */
export async function performance(
  jours: number,
): Promise<PerformanceRecherche | null> {
  const etat = await etatSearchConsole();
  if (!etat.connecte || !etat.propriete) return null;

  const jeton = await jetonAcces();
  if (!jeton) return null;

  const fin = new Date(Date.now() - 3 * 86_400_000);
  const debut = new Date(fin.getTime() - jours * 86_400_000);
  const jour = (d: Date) => d.toISOString().slice(0, 10);

  const interroger = async (dimension: string | null) => {
    const reponse = await fetch(
      `${API}/sites/${encodeURIComponent(etat.propriete!)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${jeton}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          startDate: jour(debut),
          endDate: jour(fin),
          dimensions: dimension ? [dimension] : [],
          rowLimit: dimension ? 10 : 1,
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );

    if (!reponse.ok) return [];

    const corps = (await reponse.json()) as {
      rows?: {
        keys?: string[];
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
      }[];
    };

    return corps.rows ?? [];
  };

  try {
    const [total, requetes, pages] = await Promise.all([
      interroger(null),
      interroger("query"),
      interroger("page"),
    ]);

    const t = total[0];

    return {
      clics: t?.clicks ?? 0,
      impressions: t?.impressions ?? 0,
      ctr: t ? Math.round(t.ctr * 1000) / 10 : 0,
      position: t ? Math.round(t.position * 10) / 10 : 0,
      requetes: requetes.map((r) => ({
        valeur: r.keys?.[0] ?? "",
        clics: r.clicks,
        impressions: r.impressions,
        position: Math.round(r.position * 10) / 10,
      })),
      pages: pages.map((r) => ({
        valeur: r.keys?.[0] ?? "",
        clics: r.clicks,
        impressions: r.impressions,
        position: Math.round(r.position * 10) / 10,
      })),
    };
  } catch (cause) {
    await noterErreur(
      cause instanceof Error ? cause.message : "Requête refusée.",
    );
    return null;
  }
}
