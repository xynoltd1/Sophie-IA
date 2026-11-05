import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { messagingProvider } from "@/lib/providers/messaging";
import { ownerOfNumber } from "@/lib/calls/registry";

export const dynamic = "force-dynamic";

/**
 * SMS entrant (section 18).
 *
 * Le numéro APPELÉ désigne l'entreprise, exactement comme pour un appel
 * téléphonique : c'est le seul élément que l'expéditeur ne contrôle pas. Se
 * fier au numéro de l'expéditeur, ou à un paramètre d'URL, reviendrait à
 * laisser n'importe qui écrire dans la boîte de n'importe quelle entreprise.
 *
 * Tout le travail est fait en base par `receive_inbound_message` : retrouver
 * le contact, ouvrir ou retrouver le fil, ajouter le message, alerter. En
 * plusieurs allers-retours, un webhook interrompu laisserait des fils
 * orphelins.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const headers: Record<string, string> = {};
  request.headers.forEach((valeur, cle) => {
    headers[cle] = valeur;
  });
  headers["x-webhook-url"] = request.nextUrl.toString();

  const fournisseur = messagingProvider();

  if (!fournisseur.verifyWebhook({ rawBody, headers })) {
    return new NextResponse("signature invalide", { status: 401 });
  }

  const champs = new URLSearchParams(rawBody);
  const de = champs.get("From");
  const vers = champs.get("To");
  const corps = champs.get("Body");
  const identifiant = champs.get("MessageSid") ?? champs.get("SmsSid");

  if (!de || !vers || !corps?.trim()) {
    return NextResponse.json({ ignored: true });
  }

  const proprietaire = await ownerOfNumber(vers);
  if (!proprietaire) {
    // Un numéro inconnu n'appartient à personne : mieux vaut ignorer que
    // deviner une organisation.
    console.warn("[messagerie] SMS reçu sur un numéro non rattaché");
    return NextResponse.json({ ignored: true });
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("receive_inbound_message", {
    org_id: proprietaire.organization_id,
    canal: "SMS",
    numero: de,
    contenu: corps,
    provider_id: identifiant,
  });

  if (error)
    console.error("[messagerie] message entrant non enregistré", error.message);

  // Toujours 200 : un code d'erreur ferait réessayer l'opérateur, et ses
  // réessais arrivent dans le désordre.
  return NextResponse.json({ received: true });
}
