import "server-only";

import {
  CalendarError,
  type BusyBlock,
  type CalendarProvider,
  type CalendarTokens,
  type ExternalEventInput,
  type SyncResult,
  type WatchChannel,
} from "./types";

/**
 * Google Calendar.
 *
 * Implémenté avec `fetch` plutôt qu'avec le SDK `googleapis` : ce SDK pèse
 * plusieurs dizaines de mégaoctets pour une poignée d'appels HTTP, et alourdit
 * chaque fonction serverless qui l'importe.
 *
 * Périmètre OAuth demandé : `calendar.events` seulement. Il permet de lire et
 * d'écrire des événements, pas de créer ou supprimer des agendas, pas de lire
 * les contacts. C'est le minimum nécessaire (section 41).
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/calendar/v3";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
].join(" ");

interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function readConfig(): GoogleConfig {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    const manquantes = [
      !clientId && "GOOGLE_OAUTH_CLIENT_ID",
      !clientSecret && "GOOGLE_OAUTH_CLIENT_SECRET",
      !redirectUri && "GOOGLE_OAUTH_REDIRECT_URI",
    ].filter(Boolean);

    throw new CalendarError(
      "INVALID_REQUEST",
      `Google Calendar n'est pas configuré. Variables manquantes : ${manquantes.join(", ")}.`,
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export function googleCalendarConfigured(): boolean {
  try {
    readConfig();
    return true;
  } catch {
    return false;
  }
}

/** Traduit un code HTTP Google en erreur que le domaine sait interpréter. */
function toCalendarError(status: number, body: string): CalendarError {
  // `invalid_grant` arrive avec un code 400, pas 401 — et c'est un piège.
  // Classé comme une simple requête invalide, il était réessayé indéfiniment
  // alors qu'aucune nouvelle tentative ne peut aboutir : l'autorisation est
  // morte, seul le professionnel peut en redonner une.
  //
  // Cas le plus fréquent, et de loin : une application Google en mode « Test »
  // voit ses autorisations révoquées au bout de SEPT JOURS. Tant que
  // l'application n'est pas publiée et validée, chaque agenda connecté cesse de
  // fonctionner une semaine plus tard, sans que personne n'ait rien fait.
  if (/invalid_grant/i.test(body)) {
    return new CalendarError(
      "UNAUTHORIZED",
      "L'autorisation Google a expiré ou été révoquée. Reconnectez l'agenda.",
      status,
    );
  }

  if (status === 401) {
    return new CalendarError(
      "UNAUTHORIZED",
      "Google a refusé l'autorisation. L'accès a probablement été révoqué.",
      status,
    );
  }
  if (status === 403 && /rateLimit|userRateLimit|quota/i.test(body)) {
    return new CalendarError("RATE_LIMITED", "Quota Google dépassé.", status);
  }
  if (status === 403) {
    return new CalendarError("UNAUTHORIZED", "Accès refusé par Google.", status);
  }
  if (status === 404) {
    return new CalendarError("NOT_FOUND", "Ressource introuvable chez Google.", status);
  }
  // 410 Gone sur events.list : le jeton de synchronisation incrémentale a
  // expiré. Ce n'est pas une panne, c'est une demande de tout relire.
  if (status === 410) {
    return new CalendarError(
      "SYNC_TOKEN_EXPIRED",
      "Le jeton de synchronisation a expiré, une relecture complète est nécessaire.",
      status,
    );
  }
  if (status === 429) {
    return new CalendarError("RATE_LIMITED", "Trop de requêtes vers Google.", status);
  }
  if (status >= 500) {
    return new CalendarError("UNAVAILABLE", "Google Calendar est indisponible.", status);
  }
  return new CalendarError("INVALID_REQUEST", `Google a refusé la requête : ${body.slice(0, 200)}`, status);
}

async function googleFetch(url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    // Panne réseau : on la distingue d'un refus de Google, parce que la
    // conduite à tenir n'est pas la même.
    throw new CalendarError(
      "UNAVAILABLE",
      `Google Calendar est injoignable : ${cause instanceof Error ? cause.message : "erreur réseau"}`,
    );
  }

  if (!response.ok) {
    throw toCalendarError(response.status, await response.text().catch(() => ""));
  }
  return response;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export class GoogleCalendarProvider implements CalendarProvider {
  readonly name = "GOOGLE";

  authorizationUrl(state: string): string {
    const { clientId, redirectUri } = readConfig();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      // `offline` est indispensable : sans lui, pas de jeton de
      // rafraîchissement, et l'accès meurt au bout d'une heure.
      access_type: "offline",
      // `consent` force Google à renvoyer un jeton de rafraîchissement même si
      // le professionnel a déjà autorisé l'application auparavant.
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  private async tokensFrom(body: URLSearchParams): Promise<CalendarTokens> {
    const response = await googleFetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = (await response.json()) as GoogleTokenResponse;

    let account: string | undefined;
    try {
      const infoResponse = await fetch(USERINFO_URL, {
        headers: { authorization: `Bearer ${data.access_token}` },
      });
      if (infoResponse.ok) {
        const info = (await infoResponse.json()) as { email?: string };
        account = info.email;
      }
    } catch {
      // L'adresse du compte est un confort d'affichage. Son absence ne doit
      // pas faire échouer une connexion par ailleurs valide.
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
      account,
    };
  }

  async exchangeCode(code: string): Promise<CalendarTokens> {
    const { clientId, clientSecret, redirectUri } = readConfig();
    return this.tokensFrom(
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    );
  }

  async refreshTokens(refreshToken: string): Promise<CalendarTokens> {
    const { clientId, clientSecret } = readConfig();
    return this.tokensFrom(
      new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    );
  }

  async revoke(token: string): Promise<void> {
    // Un échec de révocation ne doit pas empêcher la déconnexion locale : le
    // professionnel a demandé à couper le lien, on le coupe de notre côté quoi
    // qu'il arrive.
    try {
      await googleFetch(REVOKE_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      });
    } catch {
      /* révocation best-effort */
    }
  }

  async listBusy(params: {
    accessToken: string;
    calendarId: string;
    from: Date;
    to: Date;
    syncToken?: string | null;
  }): Promise<SyncResult> {
    const blocks: BusyBlock[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | null = null;

    do {
      const query = new URLSearchParams({
        singleEvents: "true", // développe les séries récurrentes en occurrences
        maxResults: "250",
      });

      if (params.syncToken) {
        // Avec un jeton de synchronisation, Google interdit timeMin/timeMax.
        query.set("syncToken", params.syncToken);
      } else {
        query.set("timeMin", params.from.toISOString());
        query.set("timeMax", params.to.toISOString());
        query.set("orderBy", "startTime");
      }
      if (pageToken) query.set("pageToken", pageToken);

      let response: Response;
      try {
        response = await googleFetch(
          `${API}/calendars/${encodeURIComponent(params.calendarId)}/events?${query}`,
          { headers: { authorization: `Bearer ${params.accessToken}` } },
        );
      } catch (error) {
        if (error instanceof CalendarError && error.kind === "SYNC_TOKEN_EXPIRED") {
          return { blocks: [], nextSyncToken: null, requiresFullSync: true };
        }
        throw error;
      }

      const page = (await response.json()) as {
        items?: GoogleEvent[];
        nextPageToken?: string;
        nextSyncToken?: string;
      };

      for (const event of page.items ?? []) {
        const block = toBusyBlock(event);
        if (block) blocks.push(block);
      }

      pageToken = page.nextPageToken;
      nextSyncToken = page.nextSyncToken ?? nextSyncToken;
    } while (pageToken);

    return { blocks, nextSyncToken, requiresFullSync: false };
  }

  async createEvent(params: {
    accessToken: string;
    calendarId: string;
    event: ExternalEventInput;
  }): Promise<{ externalEventId: string }> {
    const response = await googleFetch(
      `${API}/calendars/${encodeURIComponent(params.calendarId)}/events`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${params.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(toGoogleEvent(params.event)),
      },
    );

    const created = (await response.json()) as { id: string };
    return { externalEventId: created.id };
  }

  async updateEvent(params: {
    accessToken: string;
    calendarId: string;
    externalEventId: string;
    event: ExternalEventInput;
  }): Promise<void> {
    await googleFetch(
      `${API}/calendars/${encodeURIComponent(params.calendarId)}/events/${encodeURIComponent(params.externalEventId)}`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${params.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(toGoogleEvent(params.event)),
      },
    );
  }

  async deleteEvent(params: {
    accessToken: string;
    calendarId: string;
    externalEventId: string;
  }): Promise<void> {
    try {
      await googleFetch(
        `${API}/calendars/${encodeURIComponent(params.calendarId)}/events/${encodeURIComponent(params.externalEventId)}`,
        { method: "DELETE", headers: { authorization: `Bearer ${params.accessToken}` } },
      );
    } catch (error) {
      // Déjà supprimé chez Google : le résultat voulu est atteint.
      if (error instanceof CalendarError && error.kind === "NOT_FOUND") return;
      throw error;
    }
  }

  async watch(params: {
    accessToken: string;
    calendarId: string;
    callbackUrl: string;
    channelToken: string;
  }): Promise<WatchChannel> {
    const channelId = crypto.randomUUID();
    const response = await googleFetch(
      `${API}/calendars/${encodeURIComponent(params.calendarId)}/events/watch`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${params.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address: params.callbackUrl,
          // Google renvoie ce jeton dans chaque notification : c'est ainsi
          // qu'on authentifie l'appel entrant.
          token: params.channelToken,
        }),
      },
    );

    const data = (await response.json()) as { resourceId: string; expiration?: string };
    return {
      channelId,
      resourceId: data.resourceId,
      expiresAt: data.expiration
        ? new Date(Number(data.expiration))
        : new Date(Date.now() + 7 * 24 * 3600 * 1000),
    };
  }

  async stopWatch(params: {
    accessToken: string;
    channelId: string;
    resourceId: string;
  }): Promise<void> {
    try {
      await googleFetch("https://www.googleapis.com/calendar/v3/channels/stop", {
        method: "POST",
        headers: {
          authorization: `Bearer ${params.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: params.channelId, resourceId: params.resourceId }),
      });
    } catch {
      /* l'abonnement expirera de lui-même */
    }
  }
}

function toGoogleEvent(event: ExternalEventInput) {
  return {
    summary: event.title,
    description: event.description,
    location: event.location,
    start: { dateTime: event.startsAt.toISOString(), timeZone: event.timezone },
    end: { dateTime: event.endsAt.toISOString(), timeZone: event.timezone },
    ...(event.attendeeEmail ? { attendees: [{ email: event.attendeeEmail }] } : {}),
  };
}

function toBusyBlock(event: GoogleEvent): BusyBlock | null {
  const deleted = event.status === "cancelled";

  // Un événement supprimé arrive sans dates en synchronisation incrémentale.
  // On le remonte quand même : l'appelant doit savoir qu'il faut l'effacer.
  if (deleted) {
    return {
      externalEventId: event.id,
      summary: null,
      startsAt: new Date(0),
      endsAt: new Date(0),
      isAllDay: false,
      transparency: "transparent",
      deleted: true,
    };
  }

  const startRaw = event.start?.dateTime ?? event.start?.date;
  const endRaw = event.end?.dateTime ?? event.end?.date;
  if (!startRaw || !endRaw) return null;

  const isAllDay = !event.start?.dateTime;

  return {
    externalEventId: event.id,
    summary: event.summary ?? null,
    startsAt: new Date(startRaw),
    endsAt: new Date(endRaw),
    isAllDay,
    transparency: event.transparency === "transparent" ? "transparent" : "opaque",
    deleted: false,
  };
}
