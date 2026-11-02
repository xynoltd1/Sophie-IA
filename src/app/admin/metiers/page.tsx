import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createServerSupabase } from "@/lib/supabase/server";
import { SectionTitle, Sheet } from "@/components/ui/sheet";
import { MetiersEditor, type LigneMetier } from "./editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Métiers — Plateforme" };

/**
 * Les modèles de métier (section 7 et 37).
 *
 * Créer « Vitrier » ne doit pas demander un déploiement. C'est la condition
 * pour que Sophie reste universelle au lieu de devenir un logiciel de
 * plombier.
 */
export default async function MetiersPage() {
  await requirePlatformAdmin();
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("profession_templates")
    .select("slug, label, is_published, suggested_services, default_appointment_minutes")
    .order("sort_order")
    .order("label");

  const metiers: LigneMetier[] = (
    (data ?? []) as {
      slug: string;
      label: string;
      is_published: boolean;
      suggested_services: unknown;
      default_appointment_minutes: number;
    }[]
  ).map((row) => ({
    slug: row.slug,
    label: row.label,
    is_published: row.is_published,
    services: Array.isArray(row.suggested_services) ? row.suggested_services.length : 0,
    default_appointment_minutes: row.default_appointment_minutes,
  }));

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Métiers</SectionTitle>

      <Sheet tone="neutral">
        <p className="text-sm text-ink-soft">
          Ces modèles servent au moment de l’inscription : ils remplissent les services, les
          questions et les durées. L’entreprise peut ensuite tout modifier chez elle. Changer
          un modèle ne change donc jamais la configuration d’une entreprise déjà inscrite.
        </p>
      </Sheet>

      <MetiersEditor metiers={metiers} />
    </div>
  );
}
