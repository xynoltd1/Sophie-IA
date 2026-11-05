import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { messagingProvider } from "@/lib/providers/messaging";

export const dynamic = "force-dynamic";

/**
 * Accusés de réception de l'opérateur SMS.
 *
 * Sans eux, « envoyé » veut seulement dire « accepté par l'opérateur », ce qui
 * n'est pas la même chose qu'arrivé sur le téléphone du client. Un numéro
 * éteint, un portage en cours ou un filtre anti-spam ne se voient que là.
 *
 * Signature vérifiée avant toute écriture : sans cela, n'importe qui pourrait
 * déclarer nos messages livrés — ou échoués.
 *
 * Toujours 200 au-delà de l'authentification : un code d'erreur ferait
 * réessayer l'opérateur, et ses réessais arrivent dans le désordre.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const headers: Record<string, string> = {};
  request.headers.forEach((valeur, cle) => {
    headers[cle] = valeur;
  });
  // L'opérateur signe l'URL complète en plus du corps : on la lui redonne.
  headers["x-webhook-url"] = request.nextUrl.toString();

  const fournisseur = await messagingProvider();

  if (!fournisseur.verifyWebhook({ rawBody, headers })) {
    return new NextResponse("signature invalide", { status: 401 });
  }

  const miseAJour = fournisseur.parseStatusUpdate(rawBody);
  if (!miseAJour) return NextResponse.json({ ignored: true });

  const admin = createAdminClient();

  // On ne retrouve le message que par l'identifiant du fournisseur : le corps
  // de l'accusé ne porte aucune information de notre domaine, et c'est tant
  // mieux — rien dans ce webhook ne doit pouvoir désigner une organisation.
  const { error } = await admin
    .from("outbound_messages")
    .update({
      status: miseAJour.status,
      last_error:
        miseAJour.status === "FAILED" ? "Non remis par l'opérateur." : null,
    })
    .eq("provider_message_id", miseAJour.providerMessageId);

  if (error) console.error("[messagerie] accusé non enregistré", error.message);

  return NextResponse.json({ received: true });
}
