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
 * Registre des intégrations, au 2026-09-24.
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
      "Seize migrations appliquées ; isolation multi-tenant vérifiée contre la base réelle le 2026-09-08.",
  },
  {
    key: "google-calendar",
    label: "Google Calendar",
    status: "BLOCKED_EXTERNAL_CONFIG",
    blockedBy:
      "Projet Google Cloud, API Calendar activée, écran de consentement et identifiants OAuth à créer.",
    requiredEnv: [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_REDIRECT_URI",
      "SECRETS_ENCRYPTION_KEY",
    ],
    notes:
      "Flux OAuth, rafraîchissement de jeton, synchronisation incrémentale et webhook écrits. Rien n'a jamais parlé à Google.",
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
    status: "BLOCKED_EXTERNAL_CONFIG",
    blockedBy: "Compte Vapi en région européenne (voir ADR-020).",
    requiredEnv: ["VOICE_PROVIDER", "VOICE_API_KEY", "VOICE_WEBHOOK_SECRET"],
    notes:
      "Abstraction et contrat d'outils définis. Le spike technique n'a pas encore été exécuté.",
  },
  {
    key: "transcription",
    label: "Transcription et résumé post-appel",
    status: "BLOCKED_EXTERNAL_CONFIG",
    blockedBy: "Fournisseur non choisi.",
    requiredEnv: ["AI_PROVIDER", "AI_API_KEY"],
  },
  {
    key: "messaging",
    label: "SMS de confirmation",
    status: "BLOCKED_EXTERNAL_CONFIG",
    blockedBy: "Dépend du choix de l'opérateur téléphonique.",
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
