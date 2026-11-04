import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const actions = readFileSync(
  resolve(process.cwd(), "src/app/(auth)/actions.ts"),
  "utf-8",
);

/**
 * Recuperation de mot de passe.
 *
 * L application n avait aucune page pour cela jusqu au 2026-11-04. Le bouton
 * du tableau de bord Supabase envoyait un lien qui renvoyait vers la racine du
 * site : la personne atterrissait sur la page de connexion, sans message, sans
 * comprendre. Un artisan qui perd son mot de passe serait reste dehors.
 */
describe("recuperation de mot de passe", () => {
  it("renvoie le lien vers /auth/callback, pas vers la racine", () => {
    // Seul /auth/callback sait echanger le code contre une session.
    const bloc = actions.slice(actions.indexOf("resetPasswordForEmail"));
    expect(bloc.slice(0, 300)).toContain("/auth/callback?suite=/nouveau-mot-de-passe");
  });

  it("ne dit pas si l adresse existe", () => {
    // Un message qui distingue les deux cas transforme le formulaire en
    // annuaire : on y teste des adresses une par une pour savoir lesquelles
    // ont un compte.
    const bloc = actions.slice(
      actions.indexOf("export async function requestPasswordReset"),
      actions.indexOf("export async function setNewPassword"),
    );
    expect(bloc).toContain("Si un compte existe");
  });

  it("exige une session avant de changer le mot de passe", () => {
    // Sans session, on ne sait pas de quel compte il s agit.
    const bloc = actions.slice(actions.indexOf("export async function setNewPassword"));
    expect(bloc).toContain("auth.getUser()");
    expect(bloc).toContain("updateUser({");
    expect(bloc).toContain("password: parsed.data.password");
  });

  it("la page de connexion propose le lien", () => {
    // Une page de recuperation que personne ne trouve ne sert a rien.
    const login = readFileSync(
      resolve(process.cwd(), "src/app/(auth)/login/page.tsx"),
      "utf-8",
    );
    expect(login).toContain("/mot-de-passe-oublie");
  });
});
