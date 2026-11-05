import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Consigne une panne d'un service externe (section 54).
 *
 * Son utilité est de distinguer deux situations que les journaux applicatifs
 * confondent : « notre code a un bug » et « le fournisseur est tombé ». Sans
 * cette distinction, on corrige du code qui marche.
 *
 * Visible du seul super administrateur : c'est une information d'exploitation,
 * pas une information client.
 */
export async function signalerErreurFournisseur(params: {
  provider: string;
  operation: string;
  message: string;
  organizationId?: string | null;
  correlationId?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("provider_errors").insert({
      organization_id: params.organizationId ?? null,
      provider: params.provider,
      operation: params.operation,
      message: params.message.slice(0, 500),
      correlation_id: params.correlationId ?? null,
    });

    // Le meme fait, vu de l'ecran de sante : la derniere tentative a echoue.
    // Sans cette ligne, une integration pourrait afficher « operationnel »
    // alors que ses dix dernieres operations ont rate.
    await admin.rpc("record_integration_check", {
      cle: cleIntegration(params.provider),
      issue: "FAIL",
      message: `${params.operation} : ${params.message}`.slice(0, 400),
      origine: "SYSTEM",
    });
  } catch {
    /* journaliser une panne ne doit pas en provoquer une autre */
  }
}

/**
 * Correspondance entre le nom d'un fournisseur et la clé d'une intégration.
 *
 * Les deux vocabulaires existaient déjà et ne se recouvraient pas : le journal
 * des pannes parle de `GOOGLE_CALENDAR`, le registre parle de
 * `google-calendar`. Les laisser diverger aurait donné un écran de santé où
 * les erreurs d'une intégration ne se rattachent à aucune ligne.
 */
const CLES: Record<string, string> = {
  GOOGLE_CALENDAR: "google-calendar",
  AI: "ai-postcall",
  VOICE: "voice",
  RECORDING: "recording-storage",
  SMS: "messaging",
  TWILIO: "messaging",
  MOCK: "messaging",
};

export function cleIntegration(provider: string): string {
  return CLES[provider.toUpperCase()] ?? provider.toLowerCase();
}

/**
 * Consigne un échange réel réussi.
 *
 * C'est la seule preuve qu'une intégration fonctionne **aujourd'hui**. Un
 * statut écrit dans le code dit ce que le code sait faire ; cette date dit ce
 * qui a réellement eu lieu.
 *
 * Ne lève jamais : une trace de bon fonctionnement ne doit pas casser le bon
 * fonctionnement qu'elle trace.
 */
export async function noterEchangeReussi(
  provider: string,
  operation: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc("record_integration_check", {
      cle: cleIntegration(provider),
      issue: "OK",
      message: operation.slice(0, 200),
      origine: "SYSTEM",
    });
  } catch {
    /* sans effet sur l'opération réussie */
  }
}
