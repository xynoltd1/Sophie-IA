import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { construireFil } from "@/lib/crm/timeline";

const RACINE = process.cwd();
const MIGRATION = readFileSync(
  resolve(RACINE, "supabase/migrations/20261102130000_0028_conversations.sql"),
  "utf-8",
);

describe("fil de la fiche contact", () => {
  const sources = {
    appels: [
      { id: "a1", started_at: "2026-11-01T08:00:00Z", duration_seconds: 120, status: "COMPLETED" },
    ],
    messages: [
      {
        id: "m1",
        body: "Bonjour, je confirme",
        created_at: "2026-11-02T09:00:00Z",
        direction: "INBOUND" as const,
      },
    ],
    rendezVous: [
      { id: "r1", title: "Fuite sous l evier", starts_at: "2026-11-03T07:00:00Z", status: "CONFIRMED" },
    ],
    demandes: [
      { id: "d1", title: "Probleme d electricite", created_at: "2026-10-30T10:00:00Z", status: "NEW" },
    ],
  };

  it("melange les quatre sources dans un seul fil", () => {
    const fil = construireFil(sources);
    expect(fil).toHaveLength(4);
    expect(new Set(fil.map((e) => e.genre))).toEqual(
      new Set(["APPEL", "MESSAGE_RECU", "RENDEZ_VOUS", "DEMANDE"]),
    );
  });

  it("montre le plus recent en premier", () => {
    // Sur une fiche client, ce qu on cherche est ce qui vient de se passer.
    const fil = construireFil(sources);
    expect(fil[0]?.id).toBe("rdv-r1");
    expect(fil[fil.length - 1]?.id).toBe("demande-d1");
  });

  it("distingue un message recu d un message envoye", () => {
    const fil = construireFil({
      ...sources,
      messages: [
        { id: "m1", body: "recu", created_at: "2026-11-02T09:00:00Z", direction: "INBOUND" },
        { id: "m2", body: "envoye", created_at: "2026-11-02T10:00:00Z", direction: "OUTBOUND" },
      ],
    });
    expect(fil.find((e) => e.id === "message-m1")?.genre).toBe("MESSAGE_RECU");
    expect(fil.find((e) => e.id === "message-m2")?.genre).toBe("MESSAGE_ENVOYE");
  });

  it("ecarte les dates invalides plutot que de les placer au hasard", () => {
    const fil = construireFil({
      appels: [{ id: "x", started_at: "pas une date", duration_seconds: null, status: "COMPLETED" }],
      messages: [],
      rendezVous: [],
      demandes: [],
    });
    expect(fil).toEqual([]);
  });
});

describe("messages entrants", () => {
  it("l organisation vient du numero appele, jamais de l expediteur", () => {
    // Se fier a l expediteur ou a un parametre d URL laisserait n importe qui
    // ecrire dans la boite de n importe quelle entreprise.
    const route = readFileSync(
      resolve(RACINE, "src/app/api/messaging/inbound/route.ts"),
      "utf-8",
    );
    expect(route).toContain("ownerOfNumber(vers)");
    expect(route).toContain("verifyWebhook");
  });

  it("un message rejoue ne cree pas de doublon", () => {
    expect(MIGRATION).toContain("conversation_messages_provider_idx");
    expect(MIGRATION).toContain("if provider_id is not null then");
  });

  it("un contact n a qu un fil ouvert par canal", () => {
    // Sinon chaque SMS entrant creerait une conversation, et l historique
    // deviendrait illisible.
    expect(MIGRATION).toMatch(/create unique index[\s\S]*conversations_open_unique_idx/);
  });

  it("la reception est faite en une seule operation en base", () => {
    // Un webhook interrompu au milieu laisserait des fils orphelins.
    expect(MIGRATION).toContain("function public.receive_inbound_message");
    expect(MIGRATION).toContain("revoke all on function public.receive_inbound_message");
  });

  it("prevoit tous les canaux sans pretendre qu ils fonctionnent", () => {
    expect(MIGRATION).toContain("'PHONE', 'SMS', 'WHATSAPP', 'EMAIL', 'WEB_FORM'");
  });
});

describe("portee des lectures", () => {
  it("l historique d un contact ne montre que SES messages", () => {
    // Sans la jointure stricte, cette requete ramene les messages entrants de
    // toutes les personnes de l entreprise et les affiche sur la fiche
    // ouverte. Le filtre par organisation ne suffit pas : il faut le contact.
    const page = readFileSync(
      resolve(RACINE, "src/app/(app)/app/contacts/[id]/page.tsx"),
      "utf-8",
    );
    const bloc = page.slice(page.indexOf('from("conversation_messages")'));
    expect(bloc.slice(0, 400)).toContain("conversations!inner(contact_id)");
    expect(bloc.slice(0, 400)).toContain('eq("conversations.contact_id", id)');
  });
});
