import { describe, expect, it } from "vitest";
import { can, outranks, permissionsFor } from "@/lib/auth/permissions";

describe("permissions par role", () => {
  it("le proprietaire peut tout faire", () => {
    expect(can("OWNER", "billing:manage")).toBe(true);
    expect(can("OWNER", "organization:delete")).toBe(true);
  });

  it("un administrateur ne gere pas la facturation ni la suppression", () => {
    expect(can("ADMIN", "billing:manage")).toBe(false);
    expect(can("ADMIN", "organization:delete")).toBe(false);
    expect(can("ADMIN", "members:invite")).toBe(true);
  });

  it("un membre ne modifie pas l'organisation ni les roles", () => {
    expect(can("MEMBER", "organization:update")).toBe(false);
    expect(can("MEMBER", "members:update_role")).toBe(false);
    expect(can("MEMBER", "appointments:approve")).toBe(true);
  });

  it("aucune permission sans role", () => {
    expect(can(null, "calls:read")).toBe(false);
    expect(can(undefined, "calls:read")).toBe(false);
  });

  it("la hierarchie empeche un administrateur de toucher au proprietaire", () => {
    expect(outranks("OWNER", "ADMIN")).toBe(true);
    expect(outranks("ADMIN", "OWNER")).toBe(false);
    expect(outranks("ADMIN", "ADMIN")).toBe(false);
  });

  it("chaque role expose un ensemble de permissions non vide", () => {
    for (const role of ["OWNER", "ADMIN", "MEMBER"] as const) {
      expect(permissionsFor(role).length).toBeGreaterThan(0);
    }
  });
});
