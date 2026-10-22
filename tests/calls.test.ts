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

/**
 * Un appel sans numero appele est forcement un essai.
 *
 * Personne ne peut composer un numero qui n'existe pas : un appel arrive sans
 * numero de destination vient necessairement du bouton d'essai. Le marquer
 * autrement polluerait les statistiques de l'artisan avec des appels qui n'ont
 * jamais eu lieu.
 *
 * Ce test porte sur le code source parce que la regle est une decision, pas un
 * calcul : elle doit rester lisible et ne pas se perdre dans une refonte.
 */
describe("essais depuis le navigateur", () => {
  const registre = readFileSync(
    resolve(process.cwd(), "src/lib/calls/registry.ts"),
    "utf-8",
  );
  const evenements = readFileSync(
    resolve(process.cwd(), "src/app/api/voice/events/route.ts"),
    "utf-8",
  );

  it("force is_test sur un appel sans numero appele", () => {
    const bloc = registre.slice(registre.indexOf("export async function openTestCall"));
    expect(bloc).toMatch(/is_test:\s*true/);
    // Et surtout : pas de numero de destination invente.
    expect(bloc).toMatch(/to_e164:\s*null/);
  });

  it("verifie l'organisation avant de creer l'appel", () => {
    const bloc = registre.slice(registre.indexOf("export async function openTestCall"));
    expect(bloc).toMatch(/from\("organizations"\)/);
  });

  it("n'utilise ce chemin que faute de numero appele", () => {
    // Si ce chemin devenait le chemin normal, un vrai appel pourrait etre
    // marque comme essai et disparaitre des statistiques.
    const bloc = evenements.slice(evenements.indexOf("async function demarrer"));
    expect(bloc.indexOf("openCall(")).toBeLessThan(bloc.indexOf("openTestCall("));
  });
});
