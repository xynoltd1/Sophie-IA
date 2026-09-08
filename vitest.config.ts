import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

/**
 * Vitest ne lit pas .env.local automatiquement (contrairement a Next.js).
 *
 * Deux precautions ici :
 *   1. on charge explicitement le fichier ;
 *   2. on passe le resultat par `test.env`, et non en mutant process.env.
 *      Les tests s'executent dans des processus separes : une mutation de
 *      process.env faite ici ne leur parvient pas de maniere fiable, ce qui
 *      donnait des suites « ignorees » alors que la configuration etait bien
 *      presente — un faux negatif silencieux sur un controle de securite.
 */
const fileEnv = loadEnv("test", process.cwd(), "");

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    env: fileEnv,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
