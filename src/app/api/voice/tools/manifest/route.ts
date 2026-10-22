import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { toolDefinitions } from "@/lib/sophie/tools";

export const dynamic = "force-dynamic";

/**
 * Catalogue des outils de Sophie, tel que le serveur le connaît réellement.
 *
 * Pourquoi cet endpoint existe : les outils doivent être déclarés chez le
 * fournisseur de voix pour que le modèle puisse les appeler. Les recopier à la
 * main dans une interface web est long, et surtout c'est ainsi qu'ils finissent
 * par diverger du code — un paramètre renommé ici, pas là, et Sophie appelle un
 * outil avec des arguments que le serveur ne comprend plus.
 *
 * Le script `scripts/sync-vapi-tools.mjs` lit ce catalogue et le pousse chez le
 * fournisseur. La source de vérité reste le code, et elle est lue depuis le
 * serveur réellement déployé — pas depuis une copie locale qui pourrait être en
 * avance ou en retard.
 *
 * Protégé par le même secret que les webhooks : ce catalogue ne contient aucun
 * secret, mais il décrit la surface interne de l'application, et rien n'oblige
 * à l'exposer publiquement.
 */
export async function GET(request: NextRequest) {
  const attendu = process.env.VOICE_WEBHOOK_SECRET?.trim();
  const fourni = request.headers.get("x-vapi-secret")?.trim();

  if (!attendu || !fourni || !memeSecret(fourni, attendu)) {
    return new NextResponse("non autorisé", { status: 401 });
  }

  return NextResponse.json({
    count: toolDefinitions().length,
    tools: toolDefinitions(),
  });
}

function memeSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
