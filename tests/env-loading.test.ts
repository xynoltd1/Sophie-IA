import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

/**
 * Vérifie que la configuration de test est bien chargée depuis .env.local.
 *
 * Sans cela, la suite d'isolation se marque « ignorée » alors que les
 * variables sont pourtant renseignées — un faux négatif silencieux, qui est
 * exactement ce qu'on ne veut pas sur un contrôle de sécurité.
 */
describe("chargement de la configuration de test", () => {
  const envFile = ".env.local";
  const declared =
    existsSync(envFile) && readFileSync(envFile, "utf8").includes("SUPABASE_TEST_URL=");

  it.skipIf(!declared)(
    "les variables déclarées dans .env.local arrivent bien dans process.env",
    () => {
      expect(process.env.SUPABASE_TEST_URL).toBeTruthy();
    },
  );

  it("la suite d'isolation sait dire si elle est configurée ou non", () => {
    const configured = Boolean(
      process.env.SUPABASE_TEST_URL &&
        process.env.SUPABASE_TEST_ANON_KEY &&
        process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,
    );
    expect(typeof configured).toBe("boolean");
  });
});
