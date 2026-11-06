import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cheminPublic, classifier } from "@/lib/analytics/bots";
import {
  cleDeduplication,
  domaineProvenance,
  empreinteSession,
} from "@/lib/analytics/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EVENEMENTS = [
  "PAGE_VIEW",
  "CTA_CLICK",
  "SIGNUP_STARTED",
  "SIGNUP_DONE",
] as const;

/**
 * Collecte de la fréquentation du site public.
 *
 * ## Pourquoi côté serveur
 *
 * La classification a besoin de l'agent utilisateur et de l'adresse IP, qui ne
 * doivent ni être stockés ni traverser le navigateur. Elle se fait donc ici,
 * et seuls le verdict et une empreinte en sortent.
 *
 * ## Ce qui est refusé
 *
 * Les chemins privés : l'application et l'administration ne sont pas du site
 * public, et les compter ensemble rendrait les deux chiffres faux. Les
 * événements inconnus. Les corps trop gros. Les rejeux, écartés par une
 * contrainte d'unicité en base plutôt que par une vérification applicative,
 * qui laisserait passer deux requêtes simultanées.
 *
 * ## Ce qui n'est jamais renvoyé
 *
 * Rien. La réponse est vide et toujours identique, qu'un événement ait été
 * écrit ou non. Un collecteur qui répond « déjà vu » ou « refusé » apprend à
 * qui l'interroge comment contourner le filtrage.
 */
export async function POST(request: NextRequest) {
  // 204 dans tous les cas, y compris en cas d'erreur : la mesure ne doit
  // jamais abîmer la page qu'elle mesure.
  const fin = () => new NextResponse(null, { status: 204 });

  try {
    // Le refus de suivi, avant tout le reste.
    //
    // `DNT: 1` et `Sec-GPC: 1` sont des demandes explicites de ne pas être
    // suivi, émises par le navigateur. Les ignorer parce que notre mesure est
    // déjà sans cookie serait répondre à côté : la personne demande à ne pas
    // être comptée, pas à ne pas recevoir de cookie. Le respecter coûte deux
    // lignes et quelques visites non comptées, et c'est ce que la page
    // publique sur les cookies promet.
    if (
      request.headers.get("dnt") === "1" ||
      request.headers.get("sec-gpc") === "1"
    ) {
      return fin();
    }

    const brut = await request.text();
    if (brut.length > 2_000) return fin();

    const corps = JSON.parse(brut) as {
      event?: string;
      path?: string;
      referrer?: string;
      utm?: { source?: string; medium?: string; campaign?: string };
      webdriver?: boolean;
      visible?: boolean;
      screen?: number;
    };

    const evenement = EVENEMENTS.find((e) => e === corps.event);
    if (!evenement) return fin();

    const chemin = (corps.path ?? "").split("?")[0] ?? "";
    if (!cheminPublic(chemin)) return fin();

    // Le réglage de la console peut éteindre la collecte. Lu ici, et non au
    // chargement du module : une instance démarrée avant la modification
    // continuerait sinon de compter pendant des heures.
    const { reglages } = await import("@/lib/config/platform");
    const mesure = await reglages("analytics", { enabled: true });
    if (mesure.enabled === false) return fin();

    const userAgent = request.headers.get("user-agent");
    const verdict = classifier({
      userAgent,
      webdriver: corps.webdriver,
      visible: corps.visible,
      largeurEcran: corps.screen,
    });

    const session = empreinteSession({
      // Vercel pose l'adresse réelle dans cet en-tête. Elle sert au hachage et
      // n'est jamais écrite.
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent,
      langue: request.headers.get("accept-language"),
    });

    const admin = createAdminClient();

    // Une erreur d'unicité est le fonctionnement normal : c'est la
    // déduplication qui agit. On ne la signale pas.
    await admin.from("site_events").insert({
      event_name: evenement,
      path: chemin.slice(0, 300),
      referrer_host: domaineProvenance(corps.referrer ?? null),
      utm_source: corps.utm?.source?.slice(0, 80) ?? null,
      utm_medium: corps.utm?.medium?.slice(0, 80) ?? null,
      utm_campaign: corps.utm?.campaign?.slice(0, 120) ?? null,
      session_hash: session,
      dedupe_key: cleDeduplication({ session, evenement, chemin }),
      classification: verdict.classification,
      reason: verdict.reason,
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
    });

    return fin();
  } catch {
    return fin();
  }
}
