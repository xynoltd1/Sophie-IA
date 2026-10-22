import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transitionAllowed } from "@/lib/calls/registry";
import type { CallStatus } from "@/types/database";

/**
 * Les transitions d'etat d'un appel.
 *
 * Pourquoi ces tests existent : un fournisseur de telephonie livre ses
 * webhooks sans garantie d'ordre, et les rejoue. Sans regle de transition, un
 * « ca sonne » arrive en retard repasse un appel termine en cours, et l'artisan
 * voit sur son telephone un appel qui n'existe plus.
 *
 * C'est exactement le genre de bug qu'aucun build ne detecte et qu'on ne voit
 * qu'en production, un jour de reseau lent.
 */
describe("transitions d'etat d'un appel", () => {
  const terminaux: CallStatus[] = ["COMPLETED", "MISSED", "FAILED"];

  it("laisse un appel suivre son cours normal", () => {
    expect(transitionAllowed("RINGING", "ANSWERED")).toBe(true);
    expect(transitionAllowed("ANSWERED", "COMPLETED")).toBe(true);
    expect(transitionAllowed("RINGING", "MISSED")).toBe(true);
  });

  it("refuse de faire revivre un appel termine", () => {
    for (const etat of terminaux) {
      expect(
        transitionAllowed(etat, "RINGING"),
        `${etat} -> RINGING doit etre refuse : c'est un evenement arrive en retard`,
      ).toBe(false);
      expect(transitionAllowed(etat, "ANSWERED")).toBe(false);
    }
  });

  it("accepte le meme etat deux fois — un webhook rejoue n'est pas une erreur", () => {
    const tous: CallStatus[] = [
      "RINGING",
      "ANSWERED",
      "COMPLETED",
      "MISSED",
      "FAILED",
      "TRANSFERRED",
    ];
    for (const etat of tous) {
      expect(transitionAllowed(etat, etat)).toBe(true);
    }
  });

  it("permet a un appel transfere de se terminer, mais pas de recommencer", () => {
    expect(transitionAllowed("TRANSFERRED", "COMPLETED")).toBe(true);
    expect(transitionAllowed("TRANSFERRED", "RINGING")).toBe(false);
  });
});

/**
 * Garde-fous sur la migration elle-meme.
 *
 * Ces verifications portent sur le SQL parce que les regles qu'elles protegent
 * sont dans la base, pas dans le code. Un test TypeScript ne les verrait pas.
 */
describe("migration 0019", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20261020090000_0019_calls_and_numbers.sql"),
    "utf-8",
  );

  it("rend un appel unique par fournisseur — sinon un webhook rejoue cree un doublon", () => {
    expect(sql).toMatch(/create unique index[\s\S]*?calls_provider_call_unique_idx/);
    expect(sql).toMatch(/on public\.calls \(provider, provider_call_id\)/);
  });

  it("empeche deux organisations de revendiquer le meme numero", () => {
    expect(sql).toMatch(/phone_numbers_e164_unique_idx/);
  });

  it("n'accorde aucun droit d'ecriture sur les appels au navigateur", () => {
    // Un appel est un fait constate par le fournisseur. Si le navigateur
    // pouvait en creer ou en modifier la duree, toute la facturation a la
    // minute et toutes les statistiques deviendraient declaratives.
    expect(sql).not.toMatch(/grant[^;]*insert[^;]*on public\.calls/i);
    expect(sql).not.toMatch(/grant[^;]*update[^;]*on public\.calls/i);
    expect(sql).toMatch(/grant select\s+on public\.calls\s+to authenticated/);
  });

  it("verrouille la transparence sur la nature d'IA", () => {
    // Article 50 du reglement (UE) 2024/1689, applicable depuis le 2026-08-02.
    // Un client ne doit pas pouvoir desactiver une obligation legale depuis son
    // tableau de bord : c'est nous qui serions en faute de le lui permettre.
    expect(sql).toMatch(/check \(disclose_ai = true\)/);
  });

  it("reserve la resolution d'un numero au serveur", () => {
    expect(sql).toMatch(
      /revoke all on function public\.organization_for_number\(text\) from public, anon, authenticated/,
    );
  });
});
