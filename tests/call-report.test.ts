import { describe, expect, it } from "vitest";
import { etatsDepuisRapport, lireRapport, segmentsDepuisMessages } from "@/lib/calls/report";

/**
 * La forme ci-dessous n est pas inventee : elle vient d un appel reel du
 * 2026-10-22, releve dans les journaux du fournisseur. Les tests du projet
 * portent sur la realite observee, pas sur la documentation — c est en
 * ecrivant un adaptateur contre une API devinee que la Phase 4 a perdu une
 * matinee.
 */
const MESSAGES_REELS = [
  {
    role: "system",
    time: 1792686978119,
    message: "Nous sommes aujourd'hui le 2026-10-22, un Thursday.\nTu es Sophie...",
    secondsFromStart: 0,
  },
  {
    role: "bot",
    time: 1792686980000,
    endTime: 1792686983500,
    message: "Bonjour, ici Sophie. Que puis-je faire pour vous ?",
    secondsFromStart: 1.88,
  },
  {
    role: "user",
    time: 1792686985000,
    message: "Bonjour, j'ai une fuite sous l'evier.",
    secondsFromStart: 6.9,
  },
  {
    role: "tool_calls",
    time: 1792686986000,
    message: "",
    secondsFromStart: 7.9,
    toolCalls: [{ id: "x", function: { name: "create_lead" } }],
  },
];

describe("transcription issue du rapport", () => {
  it("ne garde que la conversation", () => {
    // L instruction de depart est le prompt complet de Sophie : volumineux,
    // inutile a l artisan, et il n a rien a faire dans une transcription lue
    // par un humain. Les appels d outils non plus.
    const segments = segmentsDepuisMessages(MESSAGES_REELS);
    expect(segments.map((s) => s.speaker)).toEqual(["SOPHIE", "CLIENT"]);
    expect(segments[0]?.content).toContain("Bonjour, ici Sophie");
  });

  it("numerote les tours sans trou", () => {
    const segments = segmentsDepuisMessages(MESSAGES_REELS);
    expect(segments.map((s) => s.ordinal)).toEqual([0, 1]);
  });

  it("convertit les secondes du fournisseur en millisecondes", () => {
    // C est cette valeur qui permettra de cliquer sur une phrase et d y placer
    // le lecteur audio (section 14).
    const segments = segmentsDepuisMessages(MESSAGES_REELS);
    expect(segments[0]?.startedMs).toBe(1880);
    expect(segments[1]?.startedMs).toBe(6900);
  });

  it("calcule la fin a partir d instants de meme nature", () => {
    // `time` et `endTime` sont des instants absolus : leur difference est une
    // duree, et c est elle qu on ajoute au debut relatif. Additionner un
    // instant absolu a un debut relatif donnerait une valeur absurde.
    const segments = segmentsDepuisMessages(MESSAGES_REELS);
    expect(segments[0]?.endedMs).toBe(1880 + 3500);
    expect(segments[1]?.endedMs).toBeNull();
  });

  it("ne tombe jamais, quelle que soit la forme recue", () => {
    for (const forme of [null, undefined, 42, "texte", {}, [{}], [{ role: "bot" }]]) {
      expect(() => segmentsDepuisMessages(forme)).not.toThrow();
      expect(segmentsDepuisMessages(forme)).toEqual([]);
    }
  });
});

describe("lecture du rapport complet", () => {
  it("retrouve les valeurs aux emplacements connus", () => {
    const rapport = lireRapport({
      message: {
        artifact: {
          messages: MESSAGES_REELS,
          recordingUrl: "https://exemple.test/appel.mp3",
          transcript: "Sophie: Bonjour...",
        },
        analysis: {
          summary: "Le client signale une fuite sous l'evier.",
          structuredData: { urgency: "HIGH" },
        },
      },
    });

    expect(rapport.segments).toHaveLength(2);
    expect(rapport.resume).toBe("Le client signale une fuite sous l'evier.");
    expect(rapport.audioUrl).toBe("https://exemple.test/appel.mp3");
    expect(rapport.donnees).toEqual({ urgency: "HIGH" });
    expect(rapport.transcriptBrut).toBe("Sophie: Bonjour...");
  });

  it("accepte les emplacements alternatifs du meme contenu", () => {
    // La forme varie selon la version et selon que l appel vient d un numero
    // ou du navigateur. Chercher a plusieurs endroits coute trois lignes ;
    // se tromper coute un appel perdu.
    const rapport = lireRapport({
      message: {
        messages: MESSAGES_REELS,
        summary: "Resume",
        artifact: { recording: { stereoUrl: "https://exemple.test/s.wav" } },
      },
    });
    expect(rapport.segments).toHaveLength(2);
    expect(rapport.resume).toBe("Resume");
    expect(rapport.audioUrl).toBe("https://exemple.test/s.wav");
  });

  it("n invente rien quand la valeur est absente", () => {
    const rapport = lireRapport({ message: {} });
    expect(rapport.resume).toBeNull();
    expect(rapport.audioUrl).toBeNull();
    expect(rapport.donnees).toBeNull();
    expect(rapport.segments).toEqual([]);
  });

  it("ignore une chaine vide comme une absence", () => {
    expect(lireRapport({ message: { analysis: { summary: "   " } } }).resume).toBeNull();
  });
});

describe("etats des traitements apres lecture", () => {
  const vide = lireRapport({ message: {} });
  const complet = lireRapport({
    message: {
      artifact: { messages: MESSAGES_REELS, recordingUrl: "https://exemple.test/a.mp3" },
      analysis: { summary: "Resume" },
    },
  });

  it("distingue un echec d une absence normale", () => {
    // Sans autorisation d enregistrer, il n y a pas d echec : il n y a rien a
    // faire. La nuance est juridique (section 42), pas cosmetique.
    expect(etatsDepuisRapport(complet, { enregistrementAutorise: false }).enregistrement).toBe(
      "NOT_APPLICABLE",
    );
    expect(etatsDepuisRapport(vide, { enregistrementAutorise: true }).enregistrement).toBe(
      "FAILED",
    );
    expect(etatsDepuisRapport(complet, { enregistrementAutorise: true }).enregistrement).toBe(
      "PENDING",
    );
  });

  it("marque transcription et resume separement", () => {
    // Un resume rate ne doit jamais faire disparaitre la transcription.
    const partiel = lireRapport({ message: { artifact: { messages: MESSAGES_REELS } } });
    const etats = etatsDepuisRapport(partiel, { enregistrementAutorise: false });
    expect(etats.transcription).toBe("DONE");
    expect(etats.resume).toBe("FAILED");
  });
});
