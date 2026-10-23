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

/** Au-delà, on refuse : une réponse inattendue ne doit pas remplir le stockage. */
export const TAILLE_MAXIMUM_OCTETS = 100 * 1024 * 1024;
