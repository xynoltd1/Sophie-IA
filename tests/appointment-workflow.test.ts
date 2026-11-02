import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LONGUEUR_CONSEILLEE, construireMessage, quandLisible } from "@/lib/messaging/templates";

const RACINE = process.cwd();
const MIGRATION = readFileSync(
  resolve(RACINE, "supabase/migrations/20261102110000_0026_appointment_workflow.sql"),
  "utf-8",
);

/**
 * Les messages partent vers de vrais clients. Ce que ce fichier protege n est
 * pas la mise en forme, c est ce qu un SMS ne doit jamais contenir.
 */
describe("messages envoyes aux clients", () => {
  const contexte = { entreprise: "DIZER LTD", quand: "mardi 4 novembre à 09:00" };

  it("nomme toujours l entreprise", () => {
    // Un message qui annonce « votre rendez-vous est confirme » sans dire par
    // qui ressemble a une arnaque, et finit ignore.
    for (const modele of [
      "APPOINTMENT_CONFIRMED",
      "APPOINTMENT_CHANGE_PROPOSED",
      "APPOINTMENT_REJECTED",
      "APPOINTMENT_CANCELLED",
      "APPOINTMENT_REMINDER",
    ] as const) {
      expect(construireMessage(modele, { ...contexte, lien: "https://x.test/rdv/abc" })).toContain(
        "DIZER LTD",
      );
    }
  });

  it("tient dans un SMS pour les cas courants", () => {
    // Au-dela de 160 caracteres, l operateur decoupe et facture plusieurs
    // messages. La confirmation, la plus frequente, doit tenir.
    expect(construireMessage("APPOINTMENT_CONFIRMED", contexte).length).toBeLessThanOrEqual(
      LONGUEUR_CONSEILLEE,
    );
  });

  it("met le motif quand il existe, et rien quand il n y en a pas", () => {
    expect(construireMessage("APPOINTMENT_CANCELLED", contexte)).not.toContain("Motif");
    expect(
      construireMessage("APPOINTMENT_CANCELLED", { ...contexte, motif: "Chantier en cours" }),
    ).toContain("Motif : Chantier en cours.");
  });

  it("porte le lien de reponse dans une proposition", () => {
    const texte = construireMessage("APPOINTMENT_CHANGE_PROPOSED", {
      ...contexte,
      lien: "https://zelicall.com/rdv/jeton",
    });
    expect(texte).toContain("https://zelicall.com/rdv/jeton");
  });

  it("affiche la date dans le fuseau de l entreprise", () => {
    // Le meme instant se dit « 09:00 » a Bruxelles et « 08:00 » a Londres.
    // Un client lit l heure de sa pendule, pas celle du serveur.
    const instant = "2026-11-04T08:00:00Z";
    expect(quandLisible(instant, "Europe/Brussels")).toContain("09:00");
    expect(quandLisible(instant, "UTC")).toContain("08:00");
  });
});

describe("garanties de la migration 0026", () => {
  it("empeche deux messages identiques", () => {
    // Deux clics sur le meme bouton ne doivent pas envoyer deux SMS : cela
    // coute deux fois et fait desordre chez le client.
    expect(MIGRATION).toMatch(/create unique index[\s\S]*outbound_messages_idempotency_idx/);
  });

  it("empeche deux alertes identiques non lues", () => {
    expect(MIGRATION).toMatch(/create unique index[\s\S]*notifications_dedupe_idx/);
  });

  it("rend le jeton de proposition unique", () => {
    expect(MIGRATION).toMatch(/appointments_proposal_token_idx/);
  });

  it("refuse une proposition acceptee sur un creneau deja pris", () => {
    // La contrainte d exclusion est la seule protection contre la double
    // reservation. La reponse du client passe par le meme chemin que tout le
    // reste : si le creneau a ete pris entre-temps, l acceptation echoue.
    expect(MIGRATION).toContain("exclusion_violation");
    expect(MIGRATION).toContain("CRENEAU_PRIS");
  });

  it("refuse un jeton expire", () => {
    expect(MIGRATION).toContain("proposal_expires_at < now()");
    expect(MIGRATION).toContain("EXPIRE");
  });

  it("ne renvoie au client que ce qui est necessaire", () => {
    // Un lien de SMS peut etre transfere ou lu sur un ecran verrouille. La
    // fonction publique ne doit jamais devenir une fiche client.
    const fonction = MIGRATION.slice(
      MIGRATION.indexOf("function public.proposal_by_token"),
      MIGRATION.indexOf("grant execute on function public.proposal_by_token"),
    );
    for (const interdit of ["phone", "address", "notes", "email"]) {
      expect(fonction, `${interdit} ne doit pas sortir`).not.toContain(interdit);
    }
  });
});

describe("page publique de reponse", () => {
  it("est accessible sans session", () => {
    const middleware = readFileSync(resolve(RACINE, "middleware.ts"), "utf-8");
    expect(middleware).toContain('"/rdv"');
  });

  it("n est pas indexable", () => {
    const page = readFileSync(resolve(RACINE, "src/app/rdv/[token]/page.tsx"), "utf-8");
    expect(page).toContain("index: false");
  });
});

describe("un echec d envoi ne defait jamais un rendez-vous", () => {
  it("l action enregistre la decision avant de prevenir", () => {
    // L ordre est la garantie : si le SMS echoue, la decision tient quand
    // meme (section 26). L inverse perdrait un refus a cause d un operateur
    // injoignable.
    const actions = readFileSync(
      resolve(RACINE, "src/app/(app)/app/agenda/actions.ts"),
      "utf-8",
    );
    const bloc = actions.slice(actions.indexOf("async function deciderEtPrevenir"));
    expect(bloc.indexOf("changeAppointmentStatus")).toBeLessThan(bloc.indexOf("envoyerMessage"));
  });
});
