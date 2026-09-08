import { describe, expect, it } from "vitest";
import {
  WEEKDAYS,
  isEveryDayClosed,
  toInputTime,
  validateHours,
  type HourInput,
} from "@/lib/org/schedule";

const open = (weekday: number, opens = "08:00", closes = "17:00"): HourInput => ({
  weekday,
  is_open: true,
  opens_at: opens,
  closes_at: closes,
});

const closed = (weekday: number): HourInput => ({
  weekday,
  is_open: false,
  opens_at: "",
  closes_at: "",
});

describe("horaires d'ouverture", () => {
  it("couvre les sept jours en ISO 8601", () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0]).toMatchObject({ value: 1, label: "Lundi" });
    expect(WEEKDAYS[6]).toMatchObject({ value: 7, label: "Dimanche" });
  });

  it("raccourcit l'heure Postgres pour un champ de saisie", () => {
    expect(toInputTime("08:30:00")).toBe("08:30");
    expect(toInputTime(null)).toBe("");
  });

  it("accepte une semaine cohérente", () => {
    const hours = [open(1), open(2), open(3), open(4), open(5), closed(6), closed(7)];
    expect(validateHours(hours)).toEqual({});
  });

  it("refuse une fermeture antérieure à l'ouverture", () => {
    const hours = [open(1, "17:00", "08:00")];
    expect(validateHours(hours)[1]).toContain("après l'ouverture");
  });

  it("refuse un jour ouvert sans heures", () => {
    const hours: HourInput[] = [{ weekday: 3, is_open: true, opens_at: "", closes_at: "" }];
    expect(validateHours(hours)[3]).toContain("ouverture et de fermeture");
  });

  it("ignore les heures d'un jour fermé", () => {
    const hours: HourInput[] = [{ weekday: 6, is_open: false, opens_at: "", closes_at: "" }];
    expect(validateHours(hours)).toEqual({});
  });

  it("détecte une semaine entièrement fermée", () => {
    // Sophie ne pourrait proposer aucun rendez-vous : c'est bloquant.
    expect(isEveryDayClosed([closed(1), closed(2)])).toBe(true);
    expect(isEveryDayClosed([closed(1), open(2)])).toBe(false);
  });
});
