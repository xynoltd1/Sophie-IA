/**
 * État de maturité d'une intégration externe.
 *
 * Règle du projet : une intégration n'est jamais annoncée comme fonctionnelle
 * tant qu'elle n'a pas été réellement exercée contre le service distant. Ces
 * quatre états rendent la règle vérifiable au lieu de la laisser à la mémoire
 * de celui qui écrit la documentation.
 *
 * Ce registre est la source de vérité. `docs/INTEGRATIONS.md` le recopie ;
 * en cas de divergence, c'est ce fichier qui a raison.
 */
export type IntegrationStatus =
  /** Le code existe et compile. Jamais exercé contre le service réel. */
  | "IMPLEMENTED_UNTESTED"
  /** Exercé avec succès contre le service réel, au moins une fois. */
  | "TESTED"
  /** Le code est prêt ; il manque un compte, une clé ou une configuration. */
  | "BLOCKED_EXTERNAL_CONFIG"
  /** Testé, surveillé, et couvert par les obligations juridiques applicables. */
  | "PRODUCTION_READY";

export const STATUS_LABELS: Record<IntegrationStatus, string> = {
  IMPLEMENTED_UNTESTED: "Écrit, jamais testé",
  TESTED: "Testé en conditions réelles",
  BLOCKED_EXTERNAL_CONFIG: "En attente d'un compte ou d'une clé",
  PRODUCTION_READY: "Prêt pour la production",
};

export interface IntegrationEntry {
  key: string;
  label: string;
  status: IntegrationStatus;
  /** Ce qui manque exactement, quand le statut est BLOCKED_EXTERNAL_CONFIG. */
  blockedBy?: string;
  /** Variables d'environnement requises pour que l'intégration fonctionne. */
  requiredEnv: string[];
  notes?: string;
}

/**
 * Registre des intégrations, au 2026-11-02.
 *
 * Mettre à jour la ligne d'une intégration au moment où son état change
 * réellement — pas au moment où on espère qu'il changera.
 */
export const INTEGRATIONS: readonly IntegrationEntry[] = [
  {
    key: "supabase",
    label: "Supabase (base, authentification, stockage)",
    status: "TESTED",
    requiredEnv: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
    notes:
      "Trente migrations écrites ; isolation multi-tenant vérifiée contre la base réelle le " +
      "2026-09-08. Les migrations 0025 à 0030 ne sont pas encore appliquées sur la base de " +
      "production (voir docs/OWNER_ACTION_PLAN.md, étape A2).",
  },
  {
    key: "google-calendar",
    label: "Google Calendar",
    status: "TESTED",
    requiredEnv: [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_REDIRECT_URI",
      "SECRETS_ENCRYPTION_KEY",
    ],
    notes:
      "Exercé contre Google le 2026-10-15 : autorisation OAuth, chiffrement et stockage des " +
      "jetons, synchronisation, puis vérification par l'usage — un événement réel de 10h à 11h " +
      "dans l'agenda a retiré les créneaux de 09:00 à 11:00 des disponibilités proposées, marge " +
      "de 15 minutes comprise. Pas encore PRODUCTION_READY : l'application Google est en mode " +
      "Test, donc seules les adresses inscrites comme testeurs peuvent connecter un agenda. " +
      "La validation Google est un prérequis de mise en production (LEGAL_COMPLIANCE.md).",
  },
  {
    key: "telephony",
    label: "Téléphonie (numéros, appels entrants, SMS)",
    status: "BLOCKED_EXTERNAL_CONFIG",
    blockedBy: "Compte opérateur et numéro. Fournisseur pressenti : Twilio (voir ADR-020).",
    requiredEnv: ["TELEPHONY_PROVIDER", "TELEPHONY_ACCOUNT_SID", "TELEPHONY_AUTH_TOKEN"],
    notes: "Seule l'abstraction existe. Aucune implémentation réelle.",
  },
  {
    key: "voice",
    label: "Sophie Voice (conversation temps réel)",
    status: "TESTED",
    requiredEnv: ["VOICE_PROVIDER", "VOICE_API_KEY", "VOICE_WEBHOOK_SECRET"],
    notes:
      "Exercé par de vrais appels les 22 et 23 octobre 2026 : Sophie répond en français, " +
      "appelle les huit outils métier, crée contact, demande et rendez-vous provisoire. " +
      "Région US faute d'accès libre-service à la région européenne (ADR-026). Les appels " +
      "partent du navigateur : aucun numéro de téléphone n'est encore rattaché, donc tous " +
      "sont marqués essai.",
  },
  {
    key: "transcription",
    label: "Transcription de l'appel",
    status: "TESTED",
    requiredEnv: ["VOICE_API_KEY"],
    notes:
      "Produite par le fournisseur de voix et conservée tour par tour avec horodatage " +
      "(migration 0023). Vérifiée le 23 octobre. Qualité en français perfectible : noms " +
      "propres et numéros dictés restent mal entendus (voir docs/VOICE_PROVIDERS.md).",
  },
  {
    key: "recording-storage",
    label: "Enregistrement audio conservé chez nous",
    status: "TESTED",
    requiredEnv: ["SUPABASE_SERVICE_ROLE_KEY"],
    notes:
      "Vérifié le 23 octobre : fichier rapatrié depuis le fournisseur vers le bucket privé, " +
      "servi par adresse signée, écouté depuis la fiche d'appel. Les adresses du fournisseur " +
      "expirent, d'où le rapatriement immédiat dans le webhook.",
  },
  {
    key: "ai-postcall",
    label: "Résumé et extraction après appel",
    status: "BLOCKED_EXTERNAL_CONFIG",
    blockedBy: "Clé d'un fournisseur compatible OpenAI (AI_API_KEY). Mistral conseillé pour l'Europe.",
    requiredEnv: ["AI_PROVIDER", "AI_API_KEY"],
    notes:
      "Produits par nous à partir de la transcription conservée en base, et non par le " +
      "fournisseur de voix, dont le plan d'analyse est accepté puis ignoré (ADR-031). " +
      "Sans clé, un résumé simulé s'affiche en disant franchement qu'il est simulé.",
  },
  {
    key: "messaging",
    label: "SMS (confirmation, modification, annulation)",
    status: "BLOCKED_EXTERNAL_CONFIG",
    blockedBy: "Compte opérateur et numéro expéditeur.",
    requiredEnv: ["MESSAGING_PROVIDER", "MESSAGING_API_KEY", "MESSAGING_SENDER_ID"],
  },
] as const;

export function integrationStatus(key: string): IntegrationEntry | undefined {
  return INTEGRATIONS.find((entry) => entry.key === key);
}

/** Variables d'environnement manquantes pour une intégration donnée. */
export function missingEnvFor(key: string): string[] {
  const entry = integrationStatus(key);
  if (!entry) return [];
  return entry.requiredEnv.filter((name) => !process.env[name]?.trim());
}
