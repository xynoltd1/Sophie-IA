import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from "node:crypto";

/**
 * Chiffrement des secrets stockés en base.
 *
 * Pourquoi : un jeton de rafraîchissement Google donne un accès durable à
 * l'agenda d'un client. Stocké en clair, il fuite avec n'importe quelle copie
 * de la base — une sauvegarde égarée, un export, une clé `service_role`
 * compromise. Chiffré ici, il ne vaut rien sans la clé, qui vit dans les
 * variables d'environnement et n'est jamais dans la base.
 *
 * AES-256-GCM : chiffre et authentifie. Une valeur modifiée est rejetée au
 * déchiffrement au lieu de produire des octets silencieusement faux.
 *
 * Format stocké : v1.<iv base64url>.<tag base64url>.<chiffré base64url>
 * Le préfixe de version permettra de changer d'algorithme sans casser
 * l'existant.
 */

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // recommandé pour GCM
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;

/**
 * Clé de chiffrement, lue une seule fois.
 * Accepte 64 caractères hexadécimaux ou 44 caractères base64.
 */
function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.SECRETS_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY manquante. Elle chiffre les jetons d'agenda et de téléphonie.\n" +
        "Générez-en une avec : openssl rand -base64 32\n" +
        "Puis ajoutez-la dans .env.local et dans les variables Vercel (type Secret).",
    );
  }

  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `SECRETS_ENCRYPTION_KEY doit faire 32 octets (${key.length} reçus). ` +
        "Générez-en une avec : openssl rand -base64 32",
    );
  }

  cachedKey = key;
  return key;
}

/** La clé est-elle configurée ? Permet d'afficher un état sans lever d'erreur. */
export function secretsKeyConfigured(): boolean {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const chiffre = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    chiffre.toString("base64url"),
  ].join(".");
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Secret illisible : format inattendu.");
  }

  const [, ivPart, tagPart, dataPart] = parts as [string, string, string, string];
  const decipher = createDecipheriv(ALGO, encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Signe une valeur courte destinée à faire l'aller-retour par le navigateur —
 * typiquement le paramètre `state` d'un échange OAuth.
 *
 * Sans cette signature, un tiers pourrait forger un retour OAuth et rattacher
 * son propre agenda à l'organisation de quelqu'un d'autre.
 */
export function signPayload(payload: string): string {
  const signature = createHmac("sha256", encryptionKey()).update(payload).digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${signature}`;
}

/** Vérifie et décode une valeur signée. Renvoie null si elle a été altérée. */
export function verifyPayload(signed: string): string | null {
  const parts = signed.split(".");
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts as [string, string];
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const attendu = createHmac("sha256", encryptionKey()).update(payload).digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(attendu);
  // Comparaison à temps constant : une comparaison ordinaire fuit la position
  // du premier caractère différent.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return payload;
}
