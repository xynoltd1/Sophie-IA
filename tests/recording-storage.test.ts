import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BUCKET_ENREGISTREMENTS,
  cheminEnregistrement,
  extensionDepuisType,
  typeAudioAccepte,
} from "@/lib/calls/recording-path";

const ORG = "11111111-1111-4111-8111-111111111111";
const APPEL = "22222222-2222-4222-8222-222222222222";

/**
 * L audio est la donnee la plus sensible du produit : la voix d un client,
 * enregistree chez un artisan. La section 40 impose deux choses — un bucket
 * prive, et un chemin decide par le serveur.
 */
describe("chemin d un enregistrement", () => {
  it("derive de l organisation et de l appel, et de rien d autre", () => {
    expect(cheminEnregistrement(ORG, APPEL, "audio/mpeg")).toBe(`${ORG}/${APPEL}.mp3`);
  });

  it("refuse tout ce qui n est pas un identifiant", () => {
    // Un chemin construit a partir d une valeur libre est une traversee de
    // repertoire qui attend son heure : `../autre-entreprise/appel.mp3` est
    // une chaine parfaitement valide.
    for (const mauvais of ["../autre", "", "org", `${ORG}/..`, "'; drop table calls; --"]) {
      expect(() => cheminEnregistrement(mauvais, APPEL, "audio/mpeg")).toThrow();
      expect(() => cheminEnregistrement(ORG, mauvais, "audio/mpeg")).toThrow();
    }
  });

  it("choisit l extension d apres le type reel, jamais d apres l URL", () => {
    expect(extensionDepuisType("audio/wav")).toBe("wav");
    expect(extensionDepuisType("audio/mpeg; charset=binary")).toBe("mp3");
    expect(extensionDepuisType(null)).toBe("mp3");
  });

  it("n accepte que des types audio connus", () => {
    expect(typeAudioAccepte("audio/mpeg")).toBe(true);
    expect(typeAudioAccepte("text/html")).toBe(false);
    expect(typeAudioAccepte("application/json")).toBe(false);
    expect(typeAudioAccepte(null)).toBe(false);
  });
});

describe("le chemin d ecoute existe vraiment", () => {
  it("la route servant l audio est presente", () => {
    // L interface pointait vers `/api/calls/[id]/audio` depuis la Phase 4 alors
    // que la route n existait pas. Un lecteur audio branche sur une 404 ne
    // signale rien : il reste muet.
    expect(existsSync(resolve(process.cwd(), "src/app/api/calls/[id]/audio/route.ts"))).toBe(
      true,
    );
  });

  it("la fiche d appel et la route parlent du meme chemin", () => {
    const fiche = readFileSync(
      resolve(process.cwd(), "src/app/(app)/app/appels/[id]/page.tsx"),
      "utf-8",
    );
    expect(fiche).toContain("/api/calls/${appel.id}/audio");
  });

  it("le bucket declare dans le code est celui de la migration", () => {
    const migrations = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20261023190000_0024_recording_storage.sql"),
      "utf-8",
    );
    expect(migrations).toContain(`'${BUCKET_ENREGISTREMENTS}'`);
    // Un bucket public rendrait inutile tout le reste de la chaine.
    expect(migrations).toMatch(/public\s*=\s*false/);
  });
});

describe("choix de l adresse de telechargement", () => {
  it("prefere les adresses signees aux adresses brutes", async () => {
    const { lireRapport } = await import("@/lib/calls/report");

    // Le 23 octobre, le rapatriement a echoue avec « le fournisseur a repondu
    // 400 » : `recordingUrl` est l adresse BRUTE du fichier chez l hebergeur,
    // et elle n est pas telechargeable. Seules les `presigned...` le sont.
    const rapport = lireRapport({
      message: {
        recordingUrl: "https://hebergeur.test/brut.wav",
        artifact: {
          recordingUrl: "https://hebergeur.test/brut.wav",
          presignedMonoUrl: "https://hebergeur.test/mono.wav?signature=abc",
          presignedStereoUrl: "https://hebergeur.test/stereo.wav?signature=abc",
        },
      },
    });

    expect(rapport.audioUrl).toBe("https://hebergeur.test/mono.wav?signature=abc");
  });

  it("se rabat sur l adresse brute quand aucune signee n existe", async () => {
    // Certaines versions du fournisseur n en produisent pas. Mieux vaut
    // essayer et echouer proprement que ne rien tenter.
    const { lireRapport } = await import("@/lib/calls/report");
    const rapport = lireRapport({ message: { recordingUrl: "https://hebergeur.test/brut.wav" } });
    expect(rapport.audioUrl).toBe("https://hebergeur.test/brut.wav");
  });
});

describe("type de fichier annonce par l hebergeur", () => {
  it("devine d apres l adresse quand l hebergeur ne sait pas", async () => {
    const { typeDepuisUrl, typeIndetermine } = await import("@/lib/calls/recording-path");
    expect(typeIndetermine("application/octet-stream")).toBe(true);
    expect(typeIndetermine("audio/mpeg")).toBe(false);
    expect(typeDepuisUrl("https://h.test/appel.wav?signature=a.b.c")).toBe("audio/wav");
    expect(typeDepuisUrl("https://h.test/appel.mp3")).toBe("audio/mpeg");
    expect(typeDepuisUrl("https://h.test/appel")).toBeNull();
  });
});
