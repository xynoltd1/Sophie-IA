import { describe, expect, it } from "vitest";
import {
  CALL_STATUS_LABELS,
  formatDuration,
  formatPhone,
  isLive,
  needsAttention,
  processingLabel,
} from "@/lib/crm/calls";
import type { CallStatus, ProcessingStatus } from "@/types/database";

describe("affichage d'un appel", () => {
  it("nomme tous les etats", () => {
    const tous: CallStatus[] = [
      "RINGING",
      "ANSWERED",
      "COMPLETED",
      "MISSED",
      "FAILED",
      "TRANSFERRED",
    ];
    for (const etat of tous) {
      expect(CALL_STATUS_LABELS[etat], etat).toBeTruthy();
    }
  });

  it("distingue un appel manque d'un echec technique", () => {
    // L'artisan ne reagit pas pareil : un appel manque se rappelle, un echec
    // technique se signale.
    expect(CALL_STATUS_LABELS.MISSED).not.toBe(CALL_STATUS_LABELS.FAILED);
    expect(needsAttention("MISSED")).toBe(true);
    expect(needsAttention("FAILED")).toBe(true);
    expect(needsAttention("COMPLETED")).toBe(false);
  });

  it("reconnait un appel en cours", () => {
    expect(isLive("RINGING")).toBe(true);
    expect(isLive("ANSWERED")).toBe(true);
    expect(isLive("COMPLETED")).toBe(false);
  });

  it("parle des durees comme un humain", () => {
    expect(formatDuration(0)).toBe("0 s");
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(60)).toBe("1 min");
    expect(formatDuration(135)).toBe("2 min 15");
    expect(formatDuration(null)).toBe("—");
  });

  it("dit qu'un numero est masque au lieu de laisser un vide", () => {
    expect(formatPhone(null)).toBe("Numéro masqué");
    expect(formatPhone("+32470123456")).toBe("+32470123456");
  });

  it("ne dit rien quand il n'y a rien a dire", () => {
    // « Transcription non applicable » n'informe personne. Un echec, si.
    const muets: ProcessingStatus[] = ["DONE", "NOT_APPLICABLE"];
    for (const statut of muets) {
      expect(processingLabel(statut, "Transcription"), statut).toBeNull();
    }
    expect(processingLabel("FAILED", "Résumé")).toContain("indisponible");
    expect(processingLabel("PENDING", "Résumé")).toContain("attente");
  });
});
