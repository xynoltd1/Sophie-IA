import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RACINE = process.cwd();

function lire(chemin: string): string {
  return readFileSync(resolve(RACINE, chemin), "utf-8");
}

/**
 * Section 54 : on doit pouvoir mesurer les erreurs Voice, Calendar et SMS.
 *
 * Un `console.error` ne se mesure pas. Les journaux de la plateforme
 * d hebergement expirent, ne se comptent pas et ne se filtrent pas par
 * entreprise. Une panne qui dure trois jours y ressemble a trois accidents
 * isoles.
 *
 * Ce test verifie que chaque chemin d echec connu ecrit dans
 * `provider_errors`, la seule trace qui survit et qui s agrege.
 */
describe("journal des pannes fournisseurs", () => {
  const chemins: { fichier: string; quoi: string }[] = [
    { fichier: "src/lib/messaging/outbox.ts", quoi: "un SMS refuse" },
    {
      fichier: "src/app/(app)/app/agenda/actions.ts",
      quoi: "un rendez-vous non pousse",
    },
    {
      fichier: "src/app/api/jobs/calendar-sync/route.ts",
      quoi: "une synchronisation ratee",
    },
    { fichier: "src/lib/calls/intelligence.ts", quoi: "un resume impossible" },
    {
      fichier: "src/app/api/voice/events/route.ts",
      quoi: "un evenement vocal rejete",
    },
    { fichier: "src/lib/calls/recording-storage.ts", quoi: "un audio perdu" },
  ];

  for (const { fichier, quoi } of chemins) {
    it(`consigne ${quoi}`, () => {
      expect(lire(fichier), `${fichier} ne consigne rien`).toContain(
        "signalerErreurFournisseur",
      );
    });
  }

  it("n invente pas de fournisseur sans le nommer", () => {
    // Un journal ou toutes les lignes disent « UNKNOWN » ne sert a rien.
    for (const { fichier } of chemins) {
      const contenu = lire(fichier);
      const bloc = contenu.slice(
        contenu.indexOf("signalerErreurFournisseur({"),
      );
      // Soit un nom litteral, soit le nom que l adaptateur declare : les deux
      // donnent une ligne lisible. Ce qui est interdit, c est de ne rien dire.
      expect(bloc, `${fichier} ne nomme pas le fournisseur`).toMatch(
        /provider: ("(SMS|TWILIO|GOOGLE_CALENDAR|AI|VOICE|RECORDING)"|[a-zA-Z]+\.name)/,
      );
    }
  });

  it("le journal reste invisible du client", () => {
    // C est une information d exploitation. Une entreprise n a pas a lire les
    // pannes des autres, ni meme a savoir qu il y en a.
    const sql = lire(
      "supabase/migrations/20261102120000_0027_platform_admin.sql",
    );
    const bloc = sql.slice(sql.indexOf("public.provider_errors"));
    expect(bloc).toContain("is_platform_admin()");
  });
});
