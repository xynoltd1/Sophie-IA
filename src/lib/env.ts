import { z } from "zod";

/**
 * Validation des variables d'environnement.
 *
 * Deux schemas distincts, volontairement : tout ce qui est lu depuis le
 * navigateur doit etre prefixe NEXT_PUBLIC_. Le reste ne doit JAMAIS etre
 * importe depuis un composant client (voir src/lib/supabase/admin.ts).
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL doit etre une URL valide"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY manquante"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cachedPublicEnv: PublicEnv | null = null;

export function publicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv;

  // Les variables NEXT_PUBLIC_ sont remplacees a la compilation : on doit les
  // referencer litteralement, pas via process.env[nom].
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Configuration incomplete : ${missing}. Copiez .env.example vers .env.local et remplissez les valeurs.`,
    );
  }

  cachedPublicEnv = parsed.data;
  return cachedPublicEnv;
}

/** Cle service_role — serveur uniquement. */
export function serviceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key.length < 20) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquante. Elle est requise pour les operations d'administration cote serveur.",
    );
  }
  return key;
}
