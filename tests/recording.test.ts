import { describe, expect, it } from "vitest";
import {
  MAX_AUDIO_RETENTION_DAYS,
  callIsTest,
  canEnableRecording,
  clampRetentionDays,
  isRealRecordingAllowed,
  isRecordingActive,
  purgeDate,
  recordingBlockers,
  type RecordingPolicy,
  type ResolvedNotice,
} from "@/lib/org/recording";

const base: RecordingPolicy = {
  recording_enabled: false,
  audio_retention_days: 30,
  recording_notice_required: true,
  recording_notice_text: null,
  recording_policy_accepted_at: null,
  is_test_organization: false,
};

describe("politique d'enregistrement", () => {
  it("plafonne la retention a 30 jours", () => {
    expect(MAX_AUDIO_RETENTION_DAYS).toBe(30);
    expect(clampRetentionDays(90)).toBe(30);
    expect(clampRetentionDays(7)).toBe(7);
    expect(clampRetentionDays(0)).toBe(1);
    expect(clampRetentionDays(Number.NaN)).toBe(30);
  });

  it("refuse l'activation sans acceptation de la charte", () => {
    expect(canEnableRecording(base)).toBe(false);
    expect(isRecordingActive({ ...base, recording_enabled: true })).toBe(false);
  });

  it("autorise l'activation apres acceptation", () => {
    const accepted = { ...base, recording_policy_accepted_at: "2026-09-07T10:00:00Z" };
    expect(canEnableRecording(accepted)).toBe(true);
    expect(isRecordingActive({ ...accepted, recording_enabled: true })).toBe(true);
  });

  it("calcule la date de purge", () => {
    const recorded = new Date("2026-09-07T10:00:00Z");
    expect(purgeDate(recorded, 30).toISOString()).toBe("2026-10-07T10:00:00.000Z");
    // Une valeur hors plafond est ramenee a 30 jours, jamais au-dela.
    expect(purgeDate(recorded, 365).toISOString()).toBe("2026-10-07T10:00:00.000Z");
  });
});

describe("annonce téléphonique et autorisation d'enregistrer", () => {
  const ready: RecordingPolicy = {
    ...base,
    recording_enabled: true,
    recording_policy_accepted_at: "2026-09-07T10:00:00Z",
  };
  const validated: ResolvedNotice = {
    body: "…",
    isLegallyValidated: true,
    source: "FR/fr",
  };
  const placeholder: ResolvedNotice = { ...validated, isLegallyValidated: false };

  it("refuse l'enregistrement réel tant que l'annonce n'est pas validée", () => {
    expect(isRealRecordingAllowed(ready, placeholder)).toBe(false);
    expect(isRealRecordingAllowed(ready, null)).toBe(false);
  });

  it("autorise l'enregistrement réel une fois l'annonce validée", () => {
    expect(isRealRecordingAllowed(ready, validated)).toBe(true);
  });

  it("n'exige pas d'annonce si le pays ne l'impose pas", () => {
    expect(
      isRealRecordingAllowed({ ...ready, recording_notice_required: false }, placeholder),
    ).toBe(true);
  });

  it("énumère précisément ce qui bloque", () => {
    expect(recordingBlockers(base, null)).toHaveLength(3);
    expect(recordingBlockers(ready, validated)).toEqual([]);
    expect(recordingBlockers(ready, placeholder)[0]).toContain("NON VALIDÉ JURIDIQUEMENT");
  });
});

describe("organisations d'essai", () => {
  const real: RecordingPolicy = {
    ...base,
    recording_enabled: true,
    recording_policy_accepted_at: "2026-09-07T10:00:00Z",
  };
  const test: RecordingPolicy = { ...real, is_test_organization: true };

  it("ignore le drapeau de test dans une organisation normale", () => {
    // Le cœur de la protection : marquer un appel réel comme test ne suffit pas.
    expect(callIsTest(real, true)).toBe(false);
  });

  it("reconnaît un appel de test dans une organisation d'essai", () => {
    expect(callIsTest(test, true)).toBe(true);
  });

  it("un appel non marqué n'est jamais un test", () => {
    expect(callIsTest(test, false)).toBe(false);
    expect(callIsTest(real, false)).toBe(false);
  });

  it("signale clairement qu'une organisation d'essai n'accueille aucun tiers réel", () => {
    expect(recordingBlockers(test, null)[0]).toContain("essai");
  });
});
