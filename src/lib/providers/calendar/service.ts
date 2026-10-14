import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { GoogleCalendarProvider } from "./google";
import { CalendarError, type CalendarProvider, type CalendarTokens } from "./types";

/**
 * Service d'agenda externe.
 *
 * Ce module est le SEUL endroit où les jetons sont déchiffrés. Il s'appuie sur
 * le client d'administration parce que les colonnes de jetons n'ont aucun
 * privilège pour `authenticated` (migration 0017) — c'est voulu.
 *
 * Contrepartie de ce privilège : chaque fonction exige un `actorUserId` dont
 * l'autorisation a déjà été vérifiée par l'appelant, et journalise son action
 * dans `audit_logs`.
 */

export function getCalendarProvider(): CalendarProvider {
  // Une seule implémentation aujourd'hui. Le point d'extension est ici, pas
  // dans le code métier.
  return new GoogleCalendarProvider();
}

/** Fenêtre synchronisée : assez large pour l'agenda d'un artisan, pas plus. */
const SYNC_WINDOW_DAYS_AHEAD = 90;
const SYNC_WINDOW_DAYS_BACK = 7;

/**
 * Doit rester identique au seuil de `calendar_sync_state` (migration 0017).
 * Si les deux divergent, l'application croira synchroniser alors que la base
 * considerera toujours l'agenda comme perime.
 */
const FRESHNESS_WINDOW_MINUTES = 30;

/**
 * Au-dela, on rend la main sans attendre Google. Pendant un appel telephonique,
 * faire patienter le client est pire que proposer de le rappeler.
 */
const ON_DEMAND_SYNC_TIMEOUT_MS = 6_000;

/** On rafraîchit avant l'expiration réelle : une requête en vol ne doit pas expirer. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface ConnectionRow {
  id: string;
  organization_id: string;
  member_id: string | null;
  provider: string;
  calendar_id: string | null;
  external_account: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  sync_token: string | null;
  channel_id: string | null;
  channel_expires_at: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  consecutive_failures: number;
}

async function audit(
  organizationId: string | null,
  actorUserId: string | null,
  action: string,
  outcome: "SUCCESS" | "DENIED" | "ERROR",
  details: Record<string, unknown> = {},
) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: actorUserId,
    action,
    resource_type: "calendar_connection",
    outcome,
    details,
  });
}

async function loadConnection(organizationId: string): Promise<ConnectionRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("calendar_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();

  return (data as ConnectionRow | null) ?? null;
}

/**
 * Renvoie un jeton d'accès valide, en le rafraîchissant si nécessaire.
 *
 * Si Google refuse le rafraîchissement, la connexion est désactivée et une
 * erreur explicite est levée : le professionnel doit reconnecter son agenda.
 * On ne réessaie pas indéfiniment avec un jeton mort.
 */
async function freshAccessToken(connection: ConnectionRow): Promise<string> {
  if (!connection.access_token) {
    throw new CalendarError("UNAUTHORIZED", "Aucun jeton d'accès enregistré.");
  }

  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;

  if (expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return decryptSecret(connection.access_token);
  }

  if (!connection.refresh_token) {
    throw new CalendarError(
      "UNAUTHORIZED",
      "Le jeton d'accès a expiré et aucun jeton de rafraîchissement n'est disponible.",
    );
  }

  const provider = getCalendarProvider();
  const admin = createAdminClient();

  try {
    const tokens = await provider.refreshTokens(decryptSecret(connection.refresh_token));

    await admin
      .from("calendar_connections")
      .update({
        access_token: encryptSecret(tokens.accessToken),
        token_expires_at: tokens.expiresAt.toISOString(),
        // Google ne renvoie un nouveau jeton de rafraîchissement que rarement.
        ...(tokens.refreshToken
          ? { refresh_token: encryptSecret(tokens.refreshToken) }
          : {}),
        last_error: null,
        consecutive_failures: 0,
      })
      .eq("id", connection.id);

    return tokens.accessToken;
  } catch (error) {
    const kind = error instanceof CalendarError ? error.kind : "UNAVAILABLE";

    if (kind === "UNAUTHORIZED") {
      // L'utilisateur a révoqué l'accès depuis son compte Google. Insister
      // n'apportera rien ; il faut le lui dire.
      await admin
        .from("calendar_connections")
        .update({
          is_active: false,
          last_error: "Accès révoqué côté Google. Reconnectez votre agenda.",
        })
        .eq("id", connection.id);

      await audit(connection.organization_id, null, "CALENDAR_TOKEN_REVOKED", "ERROR", {
        connection_id: connection.id,
      });
    }

    throw error;
  }
}

export interface ConnectResult {
  ok: boolean;
  account?: string;
  error?: string;
}

/**
 * Finalise la connexion : échange le code, chiffre et stocke les jetons,
 * effectue une première synchronisation.
 *
 * L'autorisation de l'appelant doit avoir été vérifiée AVANT d'appeler cette
 * fonction — elle écrit avec le client d'administration.
 */
export async function connectCalendar(params: {
  organizationId: string;
  actorUserId: string;
  code: string;
}): Promise<ConnectResult> {
  const provider = getCalendarProvider();
  const admin = createAdminClient();

  let tokens: CalendarTokens;
  try {
    tokens = await provider.exchangeCode(params.code);
  } catch (error) {
    await audit(params.organizationId, params.actorUserId, "CALENDAR_CONNECT", "ERROR", {
      reason: error instanceof Error ? error.message : "échec de l'échange de code",
    });
    return {
      ok: false,
      error: "Google a refusé l'autorisation. Réessayez en repartant des paramètres.",
    };
  }

  if (!tokens.refreshToken) {
    // Sans jeton de rafraîchissement, l'accès meurt dans une heure. Mieux vaut
    // refuser la connexion que livrer un agenda qui cessera de fonctionner.
    return {
      ok: false,
      error:
        "Google n'a pas fourni d'autorisation durable. Révoquez l'accès dans votre compte Google, puis reconnectez.",
    };
  }

  const { error: upsertError } = await admin.from("calendar_connections").upsert(
    {
      organization_id: params.organizationId,
      member_id: null,
      provider: "GOOGLE",
      calendar_id: "primary",
      external_account: tokens.account ?? null,
      access_token: encryptSecret(tokens.accessToken),
      refresh_token: encryptSecret(tokens.refreshToken),
      token_expires_at: tokens.expiresAt.toISOString(),
      sync_token: null,
      is_active: true,
      last_error: null,
      consecutive_failures: 0,
    },
    { onConflict: "organization_id,member_id,provider" },
  );

  if (upsertError) {
    await audit(params.organizationId, params.actorUserId, "CALENDAR_CONNECT", "ERROR", {
      reason: upsertError.message,
    });
    return { ok: false, error: "La connexion n'a pas pu être enregistrée." };
  }

  await audit(params.organizationId, params.actorUserId, "CALENDAR_CONNECT", "SUCCESS", {
    account: tokens.account ?? null,
  });

  // Première synchronisation immédiate : sans elle, l'agenda serait annoncé
  // comme connecté mais ne bloquerait encore aucun créneau.
  await syncCalendar(params.organizationId).catch(() => undefined);

  return { ok: true, account: tokens.account };
}

export async function disconnectCalendar(params: {
  organizationId: string;
  actorUserId: string;
}): Promise<void> {
  const connection = await loadConnection(params.organizationId);
  const admin = createAdminClient();

  if (connection) {
    const provider = getCalendarProvider();

    if (connection.channel_id) {
      try {
        const token = await freshAccessToken(connection);
        await provider.stopWatch({
          accessToken: token,
          channelId: connection.channel_id,
          resourceId: connection.channel_id,
        });
      } catch {
        /* l'abonnement expirera seul */
      }
    }

    if (connection.refresh_token) {
      try {
        await provider.revoke(decryptSecret(connection.refresh_token));
      } catch {
        /* révocation best-effort */
      }
    }

    await admin.from("calendar_connections").delete().eq("id", connection.id);
    await admin
      .from("calendar_busy_blocks")
      .delete()
      .eq("organization_id", params.organizationId);
  }

  await audit(params.organizationId, params.actorUserId, "CALENDAR_DISCONNECT", "SUCCESS");
}

export interface SyncOutcome {
  ok: boolean;
  imported: number;
  removed: number;
  fullSync: boolean;
  error?: string;
}

/**
 * Synchronise les plages occupées.
 *
 * Utilise le jeton incrémental quand il existe. Si Google le refuse (410), on
 * relit toute la fenêtre — c'est prévu par le protocole, pas une anomalie.
 */
export async function syncCalendar(organizationId: string): Promise<SyncOutcome> {
  const connection = await loadConnection(organizationId);
  if (!connection) {
    return { ok: false, imported: 0, removed: 0, fullSync: false, error: "Aucun agenda connecté." };
  }

  const admin = createAdminClient();
  const provider = getCalendarProvider();

  const from = new Date(Date.now() - SYNC_WINDOW_DAYS_BACK * 86_400_000);
  const to = new Date(Date.now() + SYNC_WINDOW_DAYS_AHEAD * 86_400_000);

  try {
    const accessToken = await freshAccessToken(connection);

    let result = await provider.listBusy({
      accessToken,
      calendarId: connection.calendar_id ?? "primary",
      from,
      to,
      syncToken: connection.sync_token,
    });

    let fullSync = !connection.sync_token;

    if (result.requiresFullSync) {
      fullSync = true;
      await admin.from("calendar_busy_blocks").delete().eq("connection_id", connection.id);
      result = await provider.listBusy({
        accessToken,
        calendarId: connection.calendar_id ?? "primary",
        from,
        to,
        syncToken: null,
      });
    }

    const supprimes = result.blocks.filter((block) => block.deleted);
    const actifs = result.blocks.filter((block) => !block.deleted);

    if (supprimes.length > 0) {
      await admin
        .from("calendar_busy_blocks")
        .delete()
        .eq("connection_id", connection.id)
        .in(
          "external_event_id",
          supprimes.map((block) => block.externalEventId),
        );
    }

    if (actifs.length > 0) {
      const { error } = await admin.from("calendar_busy_blocks").upsert(
        actifs.map((block) => ({
          organization_id: organizationId,
          connection_id: connection.id,
          member_id: connection.member_id,
          external_event_id: block.externalEventId,
          // L'intitulé d'un rendez-vous personnel peut être sensible. On le
          // garde pour que le professionnel se reconnaisse, mais il n'est
          // jamais transmis au client ni à Sophie.
          summary: block.summary,
          starts_at: block.startsAt.toISOString(),
          ends_at: block.endsAt.toISOString(),
          is_all_day: block.isAllDay,
          transparency: block.transparency,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "connection_id,external_event_id" },
      );

      if (error) throw new Error(error.message);
    }

    await admin
      .from("calendar_connections")
      .update({
        sync_token: result.nextSyncToken,
        last_synced_at: new Date().toISOString(),
        ...(fullSync ? { last_full_sync_at: new Date().toISOString() } : {}),
        last_error: null,
        consecutive_failures: 0,
      })
      .eq("id", connection.id);

    return {
      ok: true,
      imported: actifs.length,
      removed: supprimes.length,
      fullSync,
    };
  } catch (error) {
    const message =
      error instanceof CalendarError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Erreur inconnue";

    await admin
      .from("calendar_connections")
      .update({
        last_error: message,
        consecutive_failures: connection.consecutive_failures + 1,
      })
      .eq("id", connection.id);

    return { ok: false, imported: 0, removed: 0, fullSync: false, error: message };
  }
}

/**
 * Écrit un rendez-vous confirmé dans l'agenda externe.
 *
 * Renvoie `null` si aucun agenda n'est connecté — ce n'est pas une erreur.
 * Lève si l'écriture échoue : l'appelant doit alors refuser d'afficher le
 * rendez-vous comme confirmé (section 22).
 */
export async function pushAppointment(params: {
  organizationId: string;
  appointmentId: string;
}): Promise<{ externalEventId: string } | null> {
  const connection = await loadConnection(params.organizationId);
  if (!connection) return null;

  const admin = createAdminClient();

  const { data: rdv } = await admin
    .from("appointments")
    .select(
      "id, title, notes, starts_at, ends_at, address_line1, postal_code, city, external_event_id, contacts(full_name, phone, email)",
    )
    .eq("id", params.appointmentId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (!rdv) return null;

  const { data: org } = await admin
    .from("organizations")
    .select("timezone")
    .eq("id", params.organizationId)
    .maybeSingle();

  const contact = (rdv as { contacts?: { full_name?: string | null; phone?: string | null } | null })
    .contacts;

  const accessToken = await freshAccessToken(connection);
  const provider = getCalendarProvider();
  const calendarId = connection.calendar_id ?? "primary";

  const event = {
    title: rdv.title as string,
    description: [
      contact?.full_name ? `Client : ${contact.full_name}` : null,
      contact?.phone ? `Téléphone : ${contact.phone}` : null,
      rdv.notes as string | null,
      "— créé par Sophie IA",
    ]
      .filter(Boolean)
      .join("\n"),
    startsAt: new Date(rdv.starts_at as string),
    endsAt: new Date(rdv.ends_at as string),
    timezone: (org?.timezone as string | undefined) ?? "Europe/Brussels",
    location:
      [rdv.address_line1, rdv.postal_code, rdv.city].filter(Boolean).join(", ") || undefined,
  };

  const existant = rdv.external_event_id as string | null;

  if (existant) {
    await provider.updateEvent({
      accessToken,
      calendarId,
      externalEventId: existant,
      event,
    });
    return { externalEventId: existant };
  }

  const created = await provider.createEvent({ accessToken, calendarId, event });

  await admin
    .from("appointments")
    .update({ external_event_id: created.externalEventId, external_provider: "GOOGLE" })
    .eq("id", params.appointmentId);

  return created;
}

export async function removeAppointment(params: {
  organizationId: string;
  appointmentId: string;
}): Promise<void> {
  const connection = await loadConnection(params.organizationId);
  if (!connection) return;

  const admin = createAdminClient();
  const { data: rdv } = await admin
    .from("appointments")
    .select("external_event_id")
    .eq("id", params.appointmentId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  const externalEventId = rdv?.external_event_id as string | null | undefined;
  if (!externalEventId) return;

  const accessToken = await freshAccessToken(connection);
  await getCalendarProvider().deleteEvent({
    accessToken,
    calendarId: connection.calendar_id ?? "primary",
    externalEventId,
  });

  await admin
    .from("appointments")
    .update({ external_event_id: null })
    .eq("id", params.appointmentId);
}

/**
 * Synchronisation à la demande.
 *
 * Pourquoi cette fonction existe : la synchronisation périodique ne peut pas
 * tourner plus d'une fois par jour sur un compte Vercel Hobby, alors que
 * `calendar_sync_state` considère un agenda comme fiable seulement s'il a été
 * relu il y a moins de 30 minutes. Dépendre de la tâche planifiée rendrait donc
 * l'agenda « périmé » presque en permanence, et Sophie refuserait de proposer
 * le moindre créneau (sections 19 et 43). Voir ADR-024.
 *
 * On synchronise donc au moment où la réponse en dépend : ouverture de l'agenda,
 * recherche de créneau pendant un appel. La tâche planifiée n'est plus qu'un
 * filet pour les connexions que personne n'a consultées.
 *
 * Trois garde-fous :
 *  - on ne synchronise que si les données sont réellement périmées ;
 *  - une connexion qui échoue en boucle est ignorée, elle ne doit pas ralentir
 *    chaque page ;
 *  - un dépassement de délai n'est jamais une erreur visible : on rend la main,
 *    l'appelant verra simplement un agenda « périmé » et agira en conséquence.
 *
 * Cette fonction ne lève jamais. Un agenda non synchronisé est un cas prévu,
 * pas une panne.
 */
export async function ensureCalendarFresh(
  organizationId: string,
  options: { timeoutMs?: number } = {},
): Promise<{ synced: boolean; reason: "FRESH" | "SYNCED" | "SKIPPED" | "TIMEOUT" | "FAILED" }> {
  const admin = createAdminClient();
  const seuil = new Date(Date.now() - FRESHNESS_WINDOW_MINUTES * 60_000).toISOString();

  const { data } = await admin
    .from("calendar_connections")
    .select("id, last_synced_at, consecutive_failures")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return { synced: false, reason: "SKIPPED" };

  const dernière = data.last_synced_at as string | null;
  if (dernière && dernière > seuil) return { synced: false, reason: "FRESH" };

  // Une connexion cassée (jeton révoqué, agenda supprimé) ne doit pas ajouter
  // son délai d'attente à chaque chargement de page.
  if ((data.consecutive_failures as number | null) !== null && (data.consecutive_failures as number) >= 3) {
    return { synced: false, reason: "SKIPPED" };
  }

  const timeoutMs = options.timeoutMs ?? ON_DEMAND_SYNC_TIMEOUT_MS;

  type Issue = "SYNCED" | "FAILED" | "TIMEOUT";

  const course = await Promise.race<Issue>([
    syncCalendar(organizationId).then((r): Issue => (r.ok ? "SYNCED" : "FAILED")),
    new Promise<Issue>((resolve) => setTimeout(() => resolve("TIMEOUT"), timeoutMs)),
  ]);

  return { synced: course === "SYNCED", reason: course };
}
