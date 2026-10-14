import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contrainte de plateforme, pas de code.
 *
 * Un compte Vercel Hobby n'accepte que des taches planifiees quotidiennes.
 * Une expression plus frequente fait echouer le DEPLOIEMENT, avant meme la
 * compilation : ni `typecheck`, ni `lint`, ni `build` ne la detectent. C'est
 * exactement ce qui est arrive a la version 0.5.1, qui etait pourtant verte
 * partout en local.
 *
 * Ce test est donc le seul garde-fou. S'il devient genant, c'est que le compte
 * est passe en Pro : changer la constante ci-dessous, pas le test.
 *
 * Voir ADR-024 et docs/DEPLOYMENT.md.
 */
const PLAN = "hobby" as "hobby" | "pro";

interface VercelConfig {
  crons?: { path: string; schedule: string }[];
}

function config(): VercelConfig {
  return JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf-8")) as VercelConfig;
}

/**
 * Vrai si l'expression cron se declenche plus d'une fois par jour.
 *
 * Les champs minute et heure doivent designer une valeur unique. Tout le reste
 * — `*`, une liste, un pas — produit plusieurs declenchements quotidiens.
 */
function plusDUneFoisParJour(schedule: string): boolean {
  const champs = schedule.trim().split(/\s+/);
  if (champs.length !== 5) return true; // expression douteuse : on refuse.

  const [minute, heure] = champs as [string, string, string, string, string];
  const valeurUnique = (champ: string) => /^\d+$/.test(champ);

  return !valeurUnique(minute) || !valeurUnique(heure);
}

describe("vercel.json", () => {
  it("declare des taches planifiees compatibles avec le plan du compte", () => {
    const crons = config().crons ?? [];

    for (const cron of crons) {
      if (PLAN === "hobby") {
        expect(
          plusDUneFoisParJour(cron.schedule),
          `Le plan Hobby refuse « ${cron.schedule} » pour ${cron.path} : ` +
            "une tache planifiee ne peut tourner qu'une fois par jour. " +
            "Le deploiement echouera. Voir ADR-024.",
        ).toBe(false);
      }
    }
  });

  it("verifie que le detecteur fonctionne", () => {
    expect(plusDUneFoisParJour("*/15 * * * *")).toBe(true);
    expect(plusDUneFoisParJour("0 * * * *")).toBe(true);
    expect(plusDUneFoisParJour("*/30 9 * * *")).toBe(true);
    expect(plusDUneFoisParJour("0 4 * * *")).toBe(false);
    expect(plusDUneFoisParJour("30 7 * * 1")).toBe(false);
  });

  it("deploie en Europe : les donnees d'appel ne doivent pas quitter l'UE", () => {
    const regions = (config() as { regions?: string[] }).regions ?? [];
    expect(regions).toContain("fra1");
  });
});
