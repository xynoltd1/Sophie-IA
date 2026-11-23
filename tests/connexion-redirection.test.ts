import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { destinationApresConnexion } from "../src/lib/auth/redirection";

const lire = (c: string) => readFileSync(resolve(process.cwd(), c), "utf-8");

describe("ou l on arrive apres une connexion", () => {
  it("dans l application, pas sur la page commerciale", () => {
    // « / » etait le tableau de bord jusqu a la 0.21.0. Depuis que la page
    // d accueil publique existe, y renvoyer depose l artisan devant
    // « Essayer Zeli » juste apres qu il a saisi son mot de passe.
    expect(destinationApresConnexion(null)).toBe("/app");
    expect(destinationApresConnexion("")).toBe("/app");
    expect(destinationApresConnexion("   ")).toBe("/app");
  });

  it("la connexion ne renvoie plus vers la racine", () => {
    const actions = lire("src/app/(auth)/actions.ts");
    const connexion = actions.slice(
      actions.indexOf("export async function signIn"),
      actions.indexOf("export async function signUp"),
    );
    expect(connexion).not.toContain('redirect("/")');
    expect(connexion).toContain("destinationApresConnexion");
  });

  it("on revient la ou l on voulait aller", () => {
    // Le middleware pose `suite` quand il intercepte quelqu un qui n est pas
    // connecte. Sans cela, la personne qui cliquait sur un lien vers un devis
    // se retrouve ailleurs apres s etre connectee.
    expect(destinationApresConnexion("/app/devis")).toBe("/app/devis");
    expect(destinationApresConnexion("/app/appels/abc-123")).toBe(
      "/app/appels/abc-123",
    );
    expect(destinationApresConnexion("/admin")).toBe("/admin");
  });

  it("le formulaire transporte reellement cette valeur", () => {
    expect(lire("src/app/(auth)/login/login-form.tsx")).toContain(
      'name="suite"',
    );
    expect(lire("src/app/(auth)/login/page.tsx")).toContain("searchParams");
  });

  it("une adresse externe deguisee est refusee", () => {
    // `suite` arrive dans l adresse de la page : n importe qui peut forger le
    // lien. Le laisser passer enverrait quelqu un sur un faux site juste
    // apres la saisie de son mot de passe, depuis un lien a notre nom.
    for (const piege of [
      "//evil.example.com",
      "https://evil.example.com",
      "http://evil.example.com",
      "javascript:alert(1)",
      "/\\evil.example.com",
      "//evil.example.com/app",
      "mailto:a@b.c",
    ]) {
      expect(destinationApresConnexion(piege), piege).toBe("/app");
    }
  });

  it("une valeur qui n est pas du texte ne passe pas", () => {
    expect(destinationApresConnexion(new File([], "x") as unknown as FormDataEntryValue)).toBe(
      "/app",
    );
  });
});
