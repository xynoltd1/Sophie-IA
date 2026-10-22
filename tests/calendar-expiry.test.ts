import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calendarMessage } from "@/lib/crm/calendar-state";

/**
 * Une autorisation expiree n'est pas un retard de synchronisation.
 *
 * Incident du 2026-10-22. L'agenda avait ete connecte le 15. Sept jours plus
 * tard, Google a revoque l'autorisation — comportement normal et documente
 * pour une application en mode « Test ». L'application a traite ce cas comme
 * une simple requete invalide : elle a reessaye en boucle, laisse la connexion
 * marquee active, et affiche « synchronisation en retard », ce qui laissait
 * croire que ca finirait par revenir tout seul.
 *
 * Rien ne revient tout seul. Seul le professionnel peut redonner l'acces.
 *
 * Ce cas se reproduira chez CHAQUE client tant que l'application Google n'est
 * pas publiee et validee : une semaine apres chaque connexion.
 */
describe("autorisation Google expiree", () => {
  it("est un etat distinct, et son message dit quoi faire", () => {
    const message = calendarMessage({
      confidence: "EXPIRED",
      connected: true,
      account: "test@example.com",
      lastSyncedAt: null,
      lastError: "invalid_grant",
    });

    expect(message).toMatch(/expir/i);
    expect(message, "le message doit dire de reconnecter").toMatch(/reconnect/i);
  });

  it("ne se confond pas avec un simple retard", () => {
    const retard = calendarMessage({
      confidence: "STALE",
      connected: true,
      account: null,
      lastSyncedAt: null,
      lastError: null,
    });

    expect(retard).not.toMatch(/reconnect/i);
  });

  it("classe invalid_grant comme une autorisation morte, pas une requete invalide", () => {
    // Google renvoie `invalid_grant` avec un code 400. Classe comme une
    // requete invalide, il etait reessaye indefiniment alors qu'aucune
    // tentative ne peut aboutir.
    const google = readFileSync(
      resolve(process.cwd(), "src/lib/providers/calendar/google.ts"),
      "utf-8",
    );

    const bloc = google.slice(google.indexOf("function toCalendarError"));
    const positionInvalidGrant = bloc.indexOf("invalid_grant");
    const positionStatut401 = bloc.indexOf("status === 401");

    expect(positionInvalidGrant).toBeGreaterThan(-1);
    // Doit etre teste AVANT les codes HTTP, sinon le 400 l'emporte.
    expect(positionInvalidGrant).toBeLessThan(positionStatut401);
  });
});
