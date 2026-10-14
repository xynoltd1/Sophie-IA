import { beforeAll, describe, expect, it } from "vitest";

/**
 * Chiffrement des secrets stockés en base.
 *
 * Ce qui est réellement testé : qu'un jeton chiffré ne ressemble pas au clair,
 * qu'il revient intact, et surtout qu'une valeur altérée est REJETÉE plutôt
 * que déchiffrée en octets silencieusement faux.
 */
beforeAll(() => {
  // Clé de test, sans valeur ailleurs.
  process.env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("chiffrement des secrets", () => {
  it("rend le clair intact après un aller-retour", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto/secrets");
    const jeton = "1//0eXaMpLe-refresh-token-google-très-long";
    expect(decryptSecret(encryptSecret(jeton))).toBe(jeton);
  });

  it("ne laisse pas le clair apparaître dans la valeur stockée", async () => {
    const { encryptSecret } = await import("@/lib/crypto/secrets");
    const chiffre = encryptSecret("mot-de-passe-visible");
    expect(chiffre).not.toContain("mot-de-passe-visible");
    expect(chiffre.startsWith("v1.")).toBe(true);
  });

  it("produit un résultat différent à chaque fois", async () => {
    const { encryptSecret } = await import("@/lib/crypto/secrets");
    // Deux chiffrés identiques révéleraient que deux comptes partagent le même
    // jeton.
    expect(encryptSecret("identique")).not.toBe(encryptSecret("identique"));
  });

  it("refuse une valeur altérée au lieu de la déchiffrer", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto/secrets");
    const chiffre = encryptSecret("jeton-original");
    const parts = chiffre.split(".");
    const altere = [parts[0], parts[1], parts[2], `${parts[3]}AA`].join(".");
    expect(() => decryptSecret(altere)).toThrow();
  });

  it("refuse un format inconnu", async () => {
    const { decryptSecret } = await import("@/lib/crypto/secrets");
    expect(() => decryptSecret("pas-un-secret")).toThrow(/illisible/i);
  });
});

describe("signature des valeurs qui transitent par le navigateur", () => {
  it("valide une valeur intacte", async () => {
    const { signPayload, verifyPayload } = await import("@/lib/crypto/secrets");
    const payload = JSON.stringify({ org: "abc", at: 1 });
    expect(verifyPayload(signPayload(payload))).toBe(payload);
  });

  it("rejette une valeur modifiée", async () => {
    const { signPayload, verifyPayload } = await import("@/lib/crypto/secrets");
    // Le cas qui compte : quelqu'un change l'organisation pour rattacher son
    // agenda au compte d'un autre.
    const signe = signPayload(JSON.stringify({ org: "victime" }));
    const falsifie = `${Buffer.from(JSON.stringify({ org: "attaquant" })).toString("base64url")}.${signe.split(".")[1]}`;
    expect(verifyPayload(falsifie)).toBeNull();
  });

  it("rejette une valeur sans signature", async () => {
    const { verifyPayload } = await import("@/lib/crypto/secrets");
    expect(verifyPayload("nimportequoi")).toBeNull();
  });
});
