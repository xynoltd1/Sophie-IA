import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Chip } from "@/components/ui/chip";
import { SectionTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";
import { VUES, estVue, type VueTaches } from "@/lib/crm/tasks";
import { listerTaches } from "@/lib/crm/tasks-query";
import { TaskList } from "./task-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tâches — Sophie IA" };

/** Ce qu'on dit quand une vue est vide, vue par vue. */
const VIDE: Record<VueTaches, { titre: string; detail: string }> = {
  retard: {
    titre: "Rien en retard",
    detail: "Tout ce qui avait une échéance a été fait à temps.",
  },
  aujourdhui: {
    titre: "Rien pour aujourd'hui",
    detail: "Aucune tâche n'arrive à échéance avant ce soir.",
  },
  ouvertes: {
    titre: "Aucune tâche",
    detail:
      "Les rappels que Sophie note pendant un appel apparaissent ici, et vous pouvez en ajouter vous-même.",
  },
  faites: {
    titre: "Rien de terminé",
    detail: "Les tâches cochées restent visibles ici.",
  },
};

export default async function TachesPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const { activeOrganization } = await requireOrganization();
  const { vue: brut } = await searchParams;
  const vue = estVue(brut);

  const supabase = await createServerSupabase();
  const { data: org } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", activeOrganization.organization_id)
    .maybeSingle();

  const fuseau = (org?.timezone as string | undefined) ?? "Europe/Brussels";
  const taches = await listerTaches(
    activeOrganization.organization_id,
    vue,
    fuseau,
  );

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Tâches</SectionTitle>

      <nav
        aria-label="Filtres"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {(Object.keys(VUES) as VueTaches[]).map((clef) => (
          <Chip
            key={clef}
            href={`/app/taches?vue=${clef}`}
            actif={clef === vue}
          >
            {VUES[clef]}
          </Chip>
        ))}
      </nav>

      {taches.length === 0 && vue === "faites" ? (
        <EmptyState title={VIDE[vue].titre} description={VIDE[vue].detail} />
      ) : (
        <>
          <TaskList taches={taches} fuseau={fuseau} vue={vue} />
          {taches.length === 0 ? (
            <EmptyState
              title={VIDE[vue].titre}
              description={VIDE[vue].detail}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
