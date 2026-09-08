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
  //
  // Piege : une variable NEXT_PUBLIC_ absente au moment du build est remplacee
  // par une CHAINE VIDE, pas par undefined. Or .default() de zod ne s'applique
  // qu'a undefined. Sans la conversion ci-dessous, une variable facultative
  // absente fait echouer la validation en production alors que tout fonctionne
  // en developpement, ou process.env est lu a l'execution.
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: vide(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: vide(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_APP_URL: vide(process.env.NEXT_PUBLIC_APP_URL),
    NEXT_PUBLIC_APP_ENV: vide(process.env.NEXT_PUBLIC_APP_ENV),
  });

  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Configuration incomplete : ${missing}.\n` +
        "En local : copiez .env.example vers .env.local et remplissez les valeurs.\n" +
        "Sur Vercel : Project Settings > Environment Variables, pour chaque " +
        "environnement (Production, Preview, Development), puis redeployez. " +
        "Les variables NEXT_PUBLIC_ sont lues au moment du build : un simple " +
        "redemarrage ne suffit pas, il faut un nouveau deploiement.",
    );
  }

  cachedPublicEnv = parsed.data;
  return cachedPublicEnv;
}

/** Une chaine vide equivaut a une variable absente. */
function vide(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
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
