import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
  .join("\n");

/**
 * Les droits d'exécution des fonctions appelées par le serveur.
 *
 * Retirer un droit n'en accorde jamais un. Les migrations retirent le droit
 * d'exécution à PUBLIC pour qu'un navigateur ne puisse pas appeler ces
 * fonctions — ce qui le retire aussi au rôle serveur, qui en a besoin.
 *
 * Quatorze fonctions étaient dans ce cas, dont celle qui fait répondre Zeli au
 * téléphone. Ces tests empêchent que la liste se vide à nouveau.
 */
describe("droit d execution des fonctions serveur", () => {
  const SERVEUR = [
    "assign_quote_reference",
    "sophie_runtime_for_number",
    "organization_for_number",
    "calls_awaiting_summary",
    "receive_inbound_message",
    "messages_to_send",
    "expired_recordings",
    "calls_to_purge",
    "purge_expired_transcripts",
    "purge_expired_summaries",
    "purge_expired_call_events",
    "purge_expired_messages",
    "record_retention_run",
    "record_integration_check",
  ];

  for (const fonction of SERVEUR) {
    it(`${fonction} est accordee au role serveur`, () => {
      const accorde = new RegExp(
        `grant execute on function public\\.${fonction}\\s*\\([^)]*\\)\\s*to [^;]*service_role`,
      );
      expect(SQL).toMatch(accorde);
    });
  }

  it("la numerotation reste fermee au navigateur", () => {
    // Un navigateur ne doit pas pouvoir s attribuer un numero de devis, meme
    // authentifie : la serie appartient au serveur.
    expect(SQL).not.toMatch(
      /grant execute on function public\.assign_quote_reference\([^)]*\)\s*to [^;]*\bauthenticated\b/,
    );
  });
});

describe("numerotation et sortie de brouillon, une seule ecriture", () => {
  const F = readFileSync(
    "supabase/migrations/20261123170000_0042_numerotation_atomique.sql",
    "utf8",
  );

  it("la fonction ecrit le numero et l etat ensemble", () => {
    // La contrainte quotes_reference_coherente interdit un brouillon qui porte
    // un numero. Les separer faisait echouer toute numerotation.
    const bloc = F.slice(F.indexOf("update public.quotes"));
    expect(bloc).toContain("reference = numero");
    expect(bloc).toContain("status    = 'ENVOYE'");
  });

  it("le serveur ne reecrit plus l etat apres elle", () => {
    const action = readFileSync("src/app/(app)/app/devis/actions.ts", "utf8");
    const envoi = action.slice(action.indexOf("export async function envoyerDevis"));
    const suite = envoi.slice(0, envoi.indexOf("export async function deciderDevis"));
    expect(suite).not.toMatch(/status: "ENVOYE"/);
  });

  it("un devis sans ligne chiffree ne peut pas etre fige", () => {
    expect(F).toContain("Un devis sans ligne chiffree ne peut pas etre fige.");
  });
});
