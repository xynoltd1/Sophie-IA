import { describe, expect, it } from "vitest";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  canTransition,
  contactLabel,
  isOpen,
  isOverdue,
  nextStatuses,
} from "@/lib/crm/pipeline";

describe("pipeline commercial", () => {
  it("chaque état a un libellé lisible par un artisan", () => {
    for (const status of LEAD_STATUSES) {
      expect(LEAD_STATUS_LABELS[status]).toBeTruthy();
      expect(LEAD_STATUS_LABELS[status]).not.toMatch(/[A-Z]{4,}/);
    }
  });

  it("distingue les prospects ouverts des prospects clos", () => {
    expect(isOpen("NEW")).toBe(true);
    expect(isOpen("APPOINTMENT")).toBe(true);
    expect(isOpen("WON")).toBe(false);
    expect(isOpen("LOST")).toBe(false);
  });

  it("interdit de sauter du nouveau au terminé", () => {
    expect(canTransition("NEW", "WON")).toBe(false);
    expect(canTransition("NEW", "QUALIFIED")).toBe(true);
  });

  it("permet de rouvrir un prospect perdu", () => {
    // Fréquent et légitime : un client rappelle des mois plus tard.
    expect(canTransition("LOST", "NEW")).toBe(true);
    expect(canTransition("LOST", "QUALIFIED")).toBe(true);
  });

  it("refuse une transition vers le même état", () => {
    for (const status of LEAD_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("chaque état propose au moins une suite", () => {
    for (const status of LEAD_STATUSES) {
      expect(nextStatuses(status).length).toBeGreaterThan(0);
    }
  });
});

describe("tâches en retard", () => {
  const maintenant = new Date("2026-09-08T12:00:00Z");

  it("détecte une échéance dépassée", () => {
    expect(isOverdue({ status: "OPEN", due_at: "2026-09-07T09:00:00Z" }, maintenant)).toBe(true);
  });

  it("ignore une tâche terminée, même en retard", () => {
    expect(isOverdue({ status: "DONE", due_at: "2026-09-07T09:00:00Z" }, maintenant)).toBe(false);
  });

  it("ignore une tâche sans échéance", () => {
    expect(isOverdue({ status: "OPEN", due_at: null }, maintenant)).toBe(false);
  });
});

describe("nom affichable d'un contact", () => {
  it("préfère le nom, puis l'entreprise, puis le téléphone", () => {
    expect(contactLabel({ full_name: "Jean Dupont", company_name: "SPRL" })).toBe("Jean Dupont");
    expect(contactLabel({ full_name: null, company_name: "Plomberie SPRL" })).toBe("Plomberie SPRL");
    expect(contactLabel({ full_name: null, phone: "0470 12 34 56" })).toBe("0470 12 34 56");
  });

  it("ne renvoie jamais une chaîne vide", () => {
    // Un contact créé pendant un appel peut n'avoir aucune information.
    expect(contactLabel({})).toBe("Contact sans nom");
    expect(contactLabel({ full_name: "   " })).toBe("Contact sans nom");
  });
});
