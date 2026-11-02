import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/states";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plateforme — Sophie IA" };

export default async function AdminAccueil() {
  await requirePlatformAdmin();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase.rpc("platform_overview");
  const vue = (Array.isArray(data) ? data[0] : data) as
    | {
        organizations_total: number;
        organizations_active: number;
        calls_7d: number;
        appointments_pending: number;
        provider_errors_24h: number;
        messages_failed: number;
      }
    | undefined;

  if (error || !vue) {
    return <ErrorState description="La vue d’ensemble n’a pas pu être chargée." />;
  }

  const cartes = [
    { libelle: "Entreprises", valeur: vue.organizations_total, detail: `${vue.organizations_active} configurées` },
    { libelle: "Appels (7 jours)", valeur: vue.calls_7d, detail: "hors essais" },
    { libelle: "Rendez-vous à valider", valeur: vue.appointments_pending, detail: "toutes entreprises" },
    { libelle: "Erreurs fournisseurs (24 h)", valeur: vue.provider_errors_24h, detail: "voir Santé" },
    { libelle: "SMS non partis", valeur: vue.messages_failed, detail: "en attente de reprise" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Vue d’ensemble</SectionTitle>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cartes.map((carte) => (
          <li key={carte.libelle}>
            <Sheet>
              <p className="font-display text-2xl font-semibold">{carte.valeur}</p>
              <p className="text-sm font-medium">{carte.libelle}</p>
              <p className="text-sm text-ink-soft">{carte.detail}</p>
            </Sheet>
          </li>
        ))}
      </ul>

      <Sheet tone="attention">
        <p className="font-medium">Ce que cet espace ne donne pas</p>
        <p className="mt-1 text-sm text-ink-soft">
          Aucun accès aux enregistrements audio des clients, par construction (section 37).
          Ce sont les voix de personnes qui n’ont pas consenti à être écoutées par un
          éditeur de logiciel. Une demande judiciaire se traite autrement, et se journalise.
        </p>
      </Sheet>
    </div>
  );
}
