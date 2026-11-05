import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  decryptSecret,
  encryptSecret,
  secretsKeyConfigured,
} from "@/lib/crypto/secrets";
import { createHash } from "node:crypto";

/**
 * La configuration de la plateforme : base d'abord, environnement ensuite.
 *
 * ## Le problème
 *
 * Chaque clé d'API vivait dans les variables d'environnement de Vercel.
 * Changer de modèle d'IA demandait donc : ouvrir Vercel, éditer une variable,
 * relancer un déploiement, attendre. Pour quelqu'un qui n'est pas
 * développeur, c'est l'équivalent de ne pas pouvoir administrer son produit.
 *
 * ## L'ordre de priorité, et pourquoi celui-là
 *
 * 1. **La base**, si une valeur y est enregistrée.
 * 2. **L'environnement**, sinon.
 *
 * La base l'emporte parce que c'est la seule des deux qu'on peut changer sans
 * redéployer. L'inverse donnerait une interface dont les réglages seraient
 * silencieusement ignorés — exactement le genre de formulaire décoratif qu'on
 * cherche à éviter.
 *
 * L'environnement reste comme filet : il porte les valeurs d'aujourd'hui, il
 * fonctionne avant que la table existe, et il permet de reprendre la main
 * depuis Vercel si l'administration devient inaccessible.
 *
 * ## Ce qui n'obéit jamais à cet ordre
 *
 * `SUPABASE_SERVICE_ROLE_KEY`, `SECRETS_ENCRYPTION_KEY` et `CRON_SECRET`
 * restent uniquement dans l'environnement, et aucun écran ne les propose. La
 * raison est mécanique : la clé qui déchiffre cette table ne peut pas être
 * rangée dedans, et la clé qui lit la base ne peut pas être lue depuis la
 * base.
 *
 * ## Le cache
 *
 * Soixante secondes, en mémoire du processus. Sur Vercel, chaque instance a sa
 * propre mémoire : une modification se propage donc en une minute au plus, à
 * mesure que les caches expirent. C'est le compromis volontaire entre « ne pas
 * interroger la base à chaque appel » et « ne pas obliger à redéployer ».
 *
 * L'écran le dit : *appliqué d'ici une minute*. Promettre l'instantané serait
 * faux dès qu'il y a deux instances.
 */

const DUREE_CACHE_MS = 60_000;

interface Entree<T> {
  valeur: T;
  expire: number;
}

const cacheReglages = new Map<string, Entree<Record<string, unknown>>>();
const cacheSecrets = new Map<string, Entree<string | null>>();

/** Vidé après chaque écriture — utile pour l'instance qui écrit, pas pour les autres. */
export function invaliderCache(): void {
  cacheReglages.clear();
  cacheSecrets.clear();
}

/**
 * Un groupe de réglages non secrets, par sa clé (`site`, `analytics`).
 *
 * Ne lève jamais : une table absente ou une base injoignable renvoie les
 * valeurs par défaut fournies par l'appelant. La page publique doit s'afficher
 * même quand la configuration ne répond pas.
 */
export async function reglages<T extends Record<string, unknown>>(
  cle: string,
  defauts: T,
): Promise<T> {
  const enCache = cacheReglages.get(cle);
  if (enCache && enCache.expire > Date.now()) {
    return { ...defauts, ...enCache.valeur } as T;
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", cle)
      .maybeSingle();

    const valeur = (data?.value as Record<string, unknown> | undefined) ?? {};
    cacheReglages.set(cle, { valeur, expire: Date.now() + DUREE_CACHE_MS });
    return { ...defauts, ...valeur } as T;
  } catch {
    return defauts;
  }
}

/** Enregistre un groupe de réglages. Fusionne : on n'écrase jamais ce qu'on n'envoie pas. */
export async function enregistrerReglages(
  cle: string,
  valeurs: Record<string, unknown>,
  parQui: string,
): Promise<boolean> {
  try {
    const admin = createAdminClient();

    const { data: existant } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", cle)
      .maybeSingle();

    const fusion = {
      ...((existant?.value as Record<string, unknown> | undefined) ?? {}),
      ...valeurs,
    };

    const { error } = await admin.from("platform_settings").upsert(
      {
        key: cle,
        value: fusion,
        updated_at: new Date().toISOString(),
        updated_by: parQui,
      },
      { onConflict: "key" },
    );

    if (error) return false;
    invaliderCache();
    return true;
  } catch {
    return false;
  }
}

/**
 * Un secret de fournisseur : la base d'abord, l'environnement ensuite.
 *
 * `null` quand ni l'un ni l'autre n'existe — jamais une chaîne vide, qui
 * passerait les tests de présence et échouerait à l'usage.
 */
export async function secret(
  provider: string,
  field: string,
  variableEnv?: string,
): Promise<string | null> {
  const cle = `${provider}:${field}`;

  const enCache = cacheSecrets.get(cle);
  if (enCache && enCache.expire > Date.now()) return enCache.valeur;

  let valeur: string | null = null;

  if (secretsKeyConfigured()) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("provider_credentials")
        .select("secret")
        .eq("provider", provider)
        .eq("field", field)
        .maybeSingle();

      if (data?.secret) valeur = decryptSecret(data.secret as string);
    } catch {
      // Base injoignable ou valeur indéchiffrable : on retombe sur
      // l'environnement plutôt que de couper le service.
      valeur = null;
    }
  }

  if (!valeur && variableEnv) {
    valeur = process.env[variableEnv]?.trim() || null;
  }

  cacheSecrets.set(cle, { valeur, expire: Date.now() + DUREE_CACHE_MS });
  return valeur;
}

/**
 * Empreinte d'un secret.
 *
 * Huit caractères d'un SHA-256 salé par la clé maîtresse. Elle sert à une
 * seule chose : vérifier qu'on a bien remplacé la clé qu'on croyait, sans
 * jamais la révéler. Salée, parce qu'une empreinte nue d'une clé courte se
 * retrouve par force brute.
 */
export function empreinte(valeur: string): string {
  const sel = process.env.SECRETS_ENCRYPTION_KEY ?? "";
  return createHash("sha256")
    .update(`${sel}|${valeur}`)
    .digest("hex")
    .slice(0, 8);
}

/** Enregistre ou remplace un secret. La valeur en clair ne quitte pas cette fonction. */
export async function enregistrerSecret(params: {
  provider: string;
  field: string;
  valeur: string;
  parQui: string;
}): Promise<{ ok: boolean; erreur?: string }> {
  if (!secretsKeyConfigured()) {
    return {
      ok: false,
      erreur:
        "SECRETS_ENCRYPTION_KEY n’est pas configurée. Sans elle, rien ne peut être chiffré.",
    };
  }

  const propre = params.valeur.trim();
  if (propre.length === 0) return { ok: false, erreur: "Valeur vide." };

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("provider_credentials").upsert(
      {
        provider: params.provider,
        field: params.field,
        secret: encryptSecret(propre),
        fingerprint: empreinte(propre),
        last4: propre.slice(-4),
        updated_at: new Date().toISOString(),
        updated_by: params.parQui,
      },
      { onConflict: "provider,field" },
    );

    if (error) return { ok: false, erreur: "L’enregistrement a échoué." };

    invaliderCache();
    return { ok: true };
  } catch {
    return { ok: false, erreur: "Le chiffrement a échoué." };
  }
}

/** Retire un secret. L'adaptateur retombe alors sur l'environnement, s'il existe. */
export async function retirerSecret(
  provider: string,
  field: string,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("provider_credentials")
      .delete()
      .eq("provider", provider)
      .eq("field", field);

    if (error) return false;
    invaliderCache();
    return true;
  } catch {
    return false;
  }
}

export interface EtatSecret {
  provider: string;
  field: string;
  fingerprint: string;
  last4: string | null;
  updated_at: string;
}

/** Ce qui est configuré en base, sans aucune valeur. */
export async function etatSecrets(): Promise<EtatSecret[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("provider_credentials")
      .select("provider, field, fingerprint, last4, updated_at");
    return (data ?? []) as EtatSecret[];
  } catch {
    return [];
  }
}
