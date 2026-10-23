/**
 * Où vit un enregistrement, et comment il s'appelle.
 *
 * Le chemin est **calculé par le serveur**, jamais fourni par le navigateur
 * (section 40). Un client qui choisirait son chemin choisirait aussi celui des
 * autres : `../../autre-entreprise/appel.mp3` est une phrase valide tant que
 * personne ne construit le chemin à sa place.
 *
 * Il dérive donc de deux identifiants que le serveur connaît déjà, et de rien
 * d'autre.
 */

export const BUCKET_ENREGISTREMENTS = "call-recordings";

const EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function extensionDepuisType(contentType: string | null): string {
  if (!contentType) return "mp3";
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return EXTENSIONS[base] ?? "mp3";
}

/**
 * Le chemin d'un enregistrement dans le bucket privé.
 *
 * Lève si l'un des identifiants n'est pas un UUID : à ce stade, ils viennent
 * tous les deux de la base. Si l'un ne ressemble pas à un identifiant, quelque
 * chose a été passé qui n'aurait pas dû l'être, et écrire le fichier serait
 * pire que s'arrêter.
 */
export function cheminEnregistrement(
  organizationId: string,
  callId: string,
  contentType: string | null,
): string {
  if (!UUID.test(organizationId) || !UUID.test(callId)) {
    throw new Error("Chemin d'enregistrement refusé : identifiants invalides.");
  }
  return `${organizationId}/${callId}.${extensionDepuisType(contentType)}`;
}

/** Le type reçu est-il un son que nous acceptons de conserver ? */
export function typeAudioAccepte(contentType: string | null): boolean {
  if (!contentType) return false;
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return base in EXTENSIONS;
}

const TYPES_PAR_EXTENSION: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  webm: "audio/webm",
};

/**
 * Le type d'un fichier d'après son adresse.
 *
 * Certains hébergeurs servent un enregistrement en `application/octet-stream`,
 * c'est-à-dire « des octets, débrouillez-vous ». Refuser le fichier pour cette
 * seule raison perdrait l'audio d'un appel réel. On regarde alors l'extension
 * de l'adresse — en coupant la partie signature, qui contient souvent des
 * points et tromperait une lecture naïve.
 */
export function typeDepuisUrl(url: string): string | null {
  const chemin = url.split("?")[0] ?? "";
  const extension = chemin.split(".").pop()?.toLowerCase() ?? "";
  return TYPES_PAR_EXTENSION[extension] ?? null;
}

/** Les types trop vagues pour décider, mais trop courants pour refuser. */
export function typeIndetermine(contentType: string | null): boolean {
  if (!contentType) return true;
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return base === "application/octet-stream" || base === "binary/octet-stream";
}

/** Au-delà, on refuse : une réponse inattendue ne doit pas remplir le stockage. */
export const TAILLE_MAXIMUM_OCTETS = 100 * 1024 * 1024;
