import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_STATUS_LABELS,
  appointmentActions,
  endOfSlot,
  formatTime,
  needsApproval,
  occupiesSlot,
} from "@/lib/crm/agenda";
import type { AppointmentStatus } from "@/types/database";

const TOUS: AppointmentStatus[] = [
  "HELD",
  "PENDING_APPROVAL",
  "CONFIRMED",
  "CHANGE_PROPOSED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
];

describe("cycle de vie d'un rendez-vous", () => {
  it("chaque état a un libellé en français", () => {
    for (const status of TOUS) {
      expect(APPOINTMENT_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it("seuls les états actifs occupent l'agenda", () => {
    // Doit refléter exactement la clause WHERE de la contrainte d'exclusion.
    // Si l'une change sans l'autre, un créneau annulé bloquerait l'agenda,
    // ou pire, deux rendez-vous pourraient se superposer.
    expect(occupiesSlot("HELD")).toBe(true);
    expect(occupiesSlot("PENDING_APPROVAL")).toBe(true);
    expect(occupiesSlot("CONFIRMED")).toBe(true);
    expect(occupiesSlot("CHANGE_PROPOSED")).toBe(true);

    expect(occupiesSlot("REJECTED")).toBe(false);
    expect(occupiesSlot("CANCELLED")).toBe(false);
    expect(occupiesSlot("COMPLETED")).toBe(false);
    expect(occupiesSlot("NO_SHOW")).toBe(false);
  });

  it("identifie ce qui attend une validation", () => {
    expect(needsApproval("PENDING_APPROVAL")).toBe(true);
    expect(needsApproval("CONFIRMED")).toBe(false);
  });

  it("propose des actions cohérentes", () => {
    expect(appointmentActions("PENDING_APPROVAL")).toContain("CONFIRMED");
    expect(appointmentActions("PENDING_APPROVAL")).toContain("REJECTED");
    expect(appointmentActions("CONFIRMED")).not.toContain("CONFIRMED");
    // Un rendez-vous clos ne propose plus rien.
    expect(appointmentActions("CANCELLED")).toEqual([]);
    expect(appointmentActions("COMPLETED")).toEqual([]);
  });
});

describe("calculs de créneaux", () => {
  it("calcule la fin d'un créneau", () => {
    expect(endOfSlot("2026-09-09T08:00:00.000Z", 90)).toBe("2026-09-09T09:30:00.000Z");
  });

  it("affiche l'heure dans le fuseau de l'entreprise", () => {
    // 07:00 UTC = 09:00 à Bruxelles en été.
    expect(formatTime("2026-07-09T07:00:00Z", "Europe/Brussels")).toBe("09:00");
  });
});
