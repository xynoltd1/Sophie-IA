import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { createServerSupabase } from "@/lib/supabase/server";
import { buildAnnouncement } from "@/lib/sophie/announcement";
import { EditeurAccueil } from "./editor";
import { ASSISTANTE_PAR_DEFAUT } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accueil téléphonique — Zelicall" };

/**
 * Ce que Zeli dit en décrochant.
 *
 * L'écran montre la phrase complète avant de proposer de la changer. Un
 * formulaire de réglages qui ne montre pas le résultat oblige à appeler son
 * propre numéro pour savoir ce qu'on vient de régler.
 */
export default async function AccueilPage() {
  const { activeOrganization: org } = await requireOrganization();
  const supabase = await createServerSupabase();

  const [{ data: config }, { data: profil }, { data: entreprise }] =
    await Promise.all([
      supabase
        .from("sophie_configurations")
        .select(
          "assistant_name, spoken_name, greeting, greeting_morning, greeting_evening, greeting_closed, notice_position",
        )
        .eq("organization_id", org.organization_id)
        .maybeSingle(),
      supabase
        .from("business_profiles")
        .select("custom_profession_label, profession_templates(label)")
        .eq("organization_id", org.organization_id)
        .maybeSingle(),
      supabase
        .from("organizations")
        .select("country_code, locale")
        .eq("id", org.organization_id)
        .maybeSingle(),
    ]);

  const assistantName = config?.assistant_name ?? ASSISTANTE_PAR_DEFAUT;
  const spokenName = config?.spoken_name ?? "";

  // L'annonce réellement due, pas une annonce d'exemple : c'est elle qui
  // s'ajoutera à la phrase, et l'aperçu doit montrer la vraie longueur.
  const annonce = await buildAnnouncement({
    organizationId: org.organization_id,
    organizationName: spokenName || org.name,
    assistantName,
    countryCode: entreprise?.country_code ?? null,
    locale: entreprise?.locale ?? "fr",
  });

  const metier =
    (profil?.profession_templates as { label?: string } | null)?.label ??
    profil?.custom_profession_label ??
    null;

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Accueil téléphonique</SectionTitle>

      <EditeurAccueil
        initial={{
          assistantName,
          spokenName,
          organizationName: org.name,
          metier,
          greeting: config?.greeting ?? "",
          greetingMorning: config?.greeting_morning ?? "",
          greetingEvening: config?.greeting_evening ?? "",
          greetingClosed: config?.greeting_closed ?? "",
          noticePosition:
            config?.notice_position === "AVANT_ACCUEIL"
              ? "AVANT_ACCUEIL"
              : "APRES_ACCUEIL",
          annonce: annonce.mentionsRecording ? annonce.text : null,
          modifiable: can(org.role, "organization:update"),
        }}
      />

      <Sheet tone="neutral">
        <p className="text-sm font-medium">
          Deux choses que cet écran ne peut pas retirer
        </p>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
          <li>
            <strong>Dire que c’est une machine.</strong> Si votre formule ne le
            dit pas, la phrase « Je suis une assistante virtuelle » est ajoutée
            toute seule. C’est une obligation européenne depuis le 2 août 2026,
            et elle pèse sur nous autant que sur vous.
          </li>
          <li>
            <strong>Annoncer l’enregistrement</strong>, quand vos appels sont
            enregistrés. Vous choisissez où la phrase tombe ; vous ne pouvez pas
            la supprimer. Elle disparaît d’elle-même si vous arrêtez
            l’enregistrement, dans{" "}
            <Link href="/app/sophie/enregistrement" className="underline">
              le réglage prévu
            </Link>
            .
          </li>
        </ul>
      </Sheet>
    </div>
  );
}
