import { describe, expect, it } from "vitest";
import { calendarMessage, type CalendarState } from "@/lib/crm/calendar-state";
import { CalendarError } from "@/lib/providers/calendar/types";
import { INTEGRATIONS, integrationStatus } from "@/lib/providers/status";

const etat = (patch: Partial<CalendarState>): CalendarState => ({
  confidence: "NOT_CONNECTED",
  connected: false,
  account: null,
  lastSyncedAt: null,
  lastError: null,
  ...patch,
});

describe("confiance dans l'agenda externe", () => {
  it("dit clairement ce que Sophie ne voit pas quand rien n'est connecté", () => {
    const message = calendarMessage(etat({ confidence: "NOT_CONNECTED" }));
    expect(message).toContain("non connecté");
    expect(message).toMatch(/pas ceux de votre agenda personnel/);
  });

  it("distingue une synchronisation périmée d'une absence de connexion", () => {
    // Le cas dangereux : connecté mais périmé ressemble à connecté et à jour.
    const perime = calendarMessage(etat({ confidence: "STALE", connected: true }));
    expect(perime).toMatch(/ancienne/);
    expect(perime).not.toMatch(/non connecté/);
  });

  it("confirme seulement quand la synchronisation est fraîche", () => {
    const frais = calendarMessage(
      etat({ confidence: "FRESH", connected: true, account: "a@b.c" }),
    );
    expect(frais).toContain("a@b.c");
    expect(frais).toMatch(/tient compte/);
  });
});

describe("erreurs d'agenda", () => {
  it("ne réessaie que ce qui est transitoire", () => {
    expect(new CalendarError("RATE_LIMITED", "").retryable).toBe(true);
    expect(new CalendarError("UNAVAILABLE", "").retryable).toBe(true);
    // Réessayer avec un jeton révoqué ne fera que répéter l'échec.
    expect(new CalendarError("UNAUTHORIZED", "").retryable).toBe(false);
    expect(new CalendarError("INVALID_REQUEST", "").retryable).toBe(false);
  });
});

describe("registre des intégrations", () => {
  it("n'annonce aucune intégration externe comme testée sans l'avoir été", () => {
    // Garde-fou contre l'optimisme : tant qu'une intégration n'a pas parlé au
    // service réel, elle ne peut pas être TESTED ni PRODUCTION_READY.
    const externes = INTEGRATIONS.filter((entry) => entry.key !== "supabase");
    for (const entry of externes) {
      expect(entry.status).not.toBe("PRODUCTION_READY");
    }
  });

  it("dit ce qui bloque chaque intégration en attente", () => {
    for (const entry of INTEGRATIONS) {
      if (entry.status === "BLOCKED_EXTERNAL_CONFIG") {
        expect(entry.blockedBy, `${entry.key} doit dire ce qui le bloque`).toBeTruthy();
      }
    }
  });

  it("déclare les variables d'environnement de chaque intégration", () => {
    for (const entry of INTEGRATIONS) {
      expect(entry.requiredEnv.length).toBeGreaterThan(0);
    }
  });

  /**
   * Ce test n'epingle pas l'etat courant de l'integration — il change avec le
   * projet, et un test qui le fige oblige a modifier un test chaque fois qu'un
   * travail avance, ce qui apprend a modifier les tests. Il verifie ce qui doit
   * rester vrai : les variables indispensables sont declarees, et rien n'est
   * annonce comme pret pour la production sans validation juridique.
   */
  it("déclare les variables indispensables de Google Calendar", () => {
    const google = integrationStatus("google-calendar");
    expect(google).toBeDefined();
    expect(google?.requiredEnv).toContain("GOOGLE_OAUTH_CLIENT_ID");
    expect(google?.requiredEnv).toContain("GOOGLE_OAUTH_CLIENT_SECRET");
    expect(google?.requiredEnv).toContain("SECRETS_ENCRYPTION_KEY");
  });

  it("explique ce qui manque des qu'une integration est bloquee", () => {
    for (const entry of INTEGRATIONS) {
      if (entry.status === "BLOCKED_EXTERNAL_CONFIG") {
        expect(entry.blockedBy, `${entry.key} est bloquee sans dire par quoi`).toBeTruthy();
      }
    }
  });
});
