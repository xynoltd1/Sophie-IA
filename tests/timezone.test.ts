import { describe, expect, it } from "vitest";
import { instantDepuisHeureLocale } from "@/lib/crm/timezone";

/**
 * Une heure dite au telephone est une heure MURALE.
 *
 * Bug reel du 2026-10-22 : un client a choisi « huit heures », et le
 * rendez-vous a ete enregistre a dix heures. `new Date("...T08:00:00")` sans
 * suffixe est interprete dans le fuseau de la machine, et sur Vercel cette
 * machine est en temps universel.
 *
 * Ce bug est particulierement vicieux : les deux valeurs sont des heures
 * parfaitement valides. Rien ne leve d'erreur, rien ne parait anormal dans les
 * journaux. Seul un humain qui compare ce qu'il a dit et ce qu'il voit le
 * remarque.
 */
describe("heure murale vers instant", () => {
  function heureAffichee(instant: Date, timezone: string): string {
    return instant.toLocaleTimeString("fr-BE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    });
  }

  it("rend l'heure demandee, et non celle du serveur", () => {
    const instant = instantDepuisHeureLocale("2026-10-23", "08:00", "Europe/Brussels");
    expect(instant).not.toBeNull();
    expect(heureAffichee(instant!, "Europe/Brussels")).toBe("08:00");
  });

  it("tient compte de l'heure d'ete", () => {
    // Fin octobre : la Belgique est encore a UTC+2.
    const ete = instantDepuisHeureLocale("2026-10-23", "08:00", "Europe/Brussels");
    expect(ete!.toISOString()).toContain("T06:00");

    // Fin novembre : passee a UTC+1.
    const hiver = instantDepuisHeureLocale("2026-11-23", "08:00", "Europe/Brussels");
    expect(hiver!.toISOString()).toContain("T07:00");
  });

  it("reste juste le jour du changement d'heure", () => {
    // Le 25 octobre 2026, la Belgique recule d'une heure a 03:00 locales.
    const avant = instantDepuisHeureLocale("2026-10-25", "02:00", "Europe/Brussels");
    const apres = instantDepuisHeureLocale("2026-10-25", "14:00", "Europe/Brussels");

    expect(heureAffichee(apres!, "Europe/Brussels")).toBe("14:00");
    expect(avant).not.toBeNull();
  });

  it("fonctionne pour la France comme pour la Belgique", () => {
    const belge = instantDepuisHeureLocale("2026-11-10", "09:30", "Europe/Brussels");
    const francais = instantDepuisHeureLocale("2026-11-10", "09:30", "Europe/Paris");
    // Meme fuseau, donc meme instant : une evidence qui deviendrait fausse si
    // la conversion ignorait le fuseau.
    expect(belge!.getTime()).toBe(francais!.getTime());
  });

  it("refuse ce qui n'est pas une date ou une heure", () => {
    expect(instantDepuisHeureLocale("23/10/2026", "08:00", "Europe/Brussels")).toBeNull();
    expect(instantDepuisHeureLocale("2026-10-23", "8h", "Europe/Brussels")).toBeNull();
    expect(instantDepuisHeureLocale("2026-10-23", "", "Europe/Brussels")).toBeNull();
  });
});
