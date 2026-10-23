import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MESSAGE_SILENCE, diagnostiquerLigne } from "@/lib/sophie/ligne";

/**
 * « Sophie repond » est la seule information de l en-tete, et elle doit etre
 * vraie. Elle a ete ecrite en dur a `false` pendant toute la Phase 0, puis
 * oubliee : l application annoncait « Sophie en pause » alors qu elle venait de
 * tenir une conversation. Et quand aucun numero n est relie, l accueil restait
 * vide sans dire pourquoi.
 */
const ACTIVE = { is_active: true, answer_mode: "ALWAYS" };
const REEL = { e164: "+3221234567", is_test: false, is_active: true };
const ESSAI = { e164: "+15551234567", is_test: true, is_active: true };

describe("etat de la ligne de Sophie", () => {
  it("repond quand tout est reuni", () => {
    expect(diagnostiquerLigne(ACTIVE, [REEL])).toEqual({
      repond: true,
      raison: null,
      numero: "+3221234567",
    });
  });

  it("signale l absence de numero avant tout le reste", () => {
    // Sans numero, activer Sophie ne sert a rien : aucun appel ne peut arriver.
    const etat = diagnostiquerLigne({ is_active: false, answer_mode: "OFF" }, []);
    expect(etat.repond).toBe(false);
    expect(etat.raison).toBe("AUCUN_NUMERO");
  });

  it("distingue une ligne d essai d une vraie ligne", () => {
    const etat = diagnostiquerLigne(ACTIVE, [ESSAI]);
    expect(etat.repond).toBe(false);
    expect(etat.raison).toBe("LIGNE_ESSAI");
    expect(etat.numero).toBe("+15551234567");
  });

  it("ignore les numeros desactives", () => {
    const etat = diagnostiquerLigne(ACTIVE, [{ ...REEL, is_active: false }]);
    expect(etat.raison).toBe("AUCUN_NUMERO");
  });

  it("dit quand Sophie n est pas activee, et quand elle ne decroche jamais", () => {
    expect(diagnostiquerLigne({ is_active: false, answer_mode: "ALWAYS" }, [REEL]).raison).toBe(
      "CONFIG_INACTIVE",
    );
    expect(diagnostiquerLigne({ is_active: true, answer_mode: "OFF" }, [REEL]).raison).toBe(
      "MODE_OFF",
    );
  });

  it("ne reste jamais muette sans explication", () => {
    // Chaque raison doit avoir un texte : un bandeau sans phrase ne vaut pas
    // mieux qu une page vide (section 44).
    for (const [raison, message] of Object.entries(MESSAGE_SILENCE)) {
      expect(message.titre.length, raison).toBeGreaterThan(5);
      expect(message.detail.length, raison).toBeGreaterThan(20);
    }
  });

  it("n est pas ecrite en dur dans la mise en page", () => {
    // La faute d origine, et la seule qui puisse revenir en silence.
    const layout = readFileSync(resolve(process.cwd(), "src/app/(app)/layout.tsx"), "utf-8");
    expect(/const sophieActive\s*=\s*(true|false)/.test(layout)).toBe(false);
    expect(layout).toContain("etatLigneSophie");
  });
});
