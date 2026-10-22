import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Une reponse d'outil doit toujours dire quoi faire ENSUITE.
 *
 * Bug reel du 2026-10-22 : l'agenda etait perime, l'outil repondait « les
 * disponibilites ne sont pas verifiables », et le modele a rappele le meme
 * outil 61 fois dans un seul appel. Il recevait une reponse inutilisable et
 * reessayait, faute d'instruction contraire.
 *
 * Au telephone, le cout est triple : l'appel s'allonge, les credits brulent, et
 * le client entend une machine bloquee.
 *
 * Ce test porte sur le texte des reponses parce que ce texte EST l'interface
 * avec le modele. Le modifier sans y penser, c'est rouvrir la boucle.
 */
describe("sorties d'erreur des outils", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/lib/sophie/tools.ts"),
    "utf-8",
  );

  const bloc = source.slice(
    source.indexOf("const checkAvailability"),
    source.indexOf("const getBusinessInformation"),
  );

  it("dit au modele d'arreter quand l'agenda n'est pas verifiable", () => {
    const indegradable = bloc.slice(bloc.indexOf("is_fresh"));
    expect(indegradable).toMatch(/N'appelle plus check_availability/);
  });

  it("dit au modele d'arreter quand la consultation echoue", () => {
    const erreur = bloc.slice(bloc.indexOf("Impossible de consulter"));
    expect(erreur.slice(0, 400)).toMatch(/N'appelle plus check_availability/);
  });

  it("interdit de redemander la meme date quand il n'y a aucun creneau", () => {
    const vide = bloc.slice(bloc.indexOf("Aucun créneau libre"));
    expect(vide.slice(0, 400)).toMatch(/jamais cet outil avec la même date/);
  });

  it("propose toujours une action de repli concrete", () => {
    // Un message qui dit seulement « ca ne marche pas » laisse le modele
    // improviser, et il improvise en reessayant.
    const indegradable = bloc.slice(bloc.indexOf("is_fresh"), bloc.indexOf("const duree"));
    expect(indegradable).toMatch(/create_lead/);
  });
});
