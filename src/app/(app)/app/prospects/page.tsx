import { SectionTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";

export const metadata = { title: "Prospects — Sophie IA" };

export default function ProspectsPage() {
  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Prospects</SectionTitle>
      <EmptyState
        title="Aucun prospect pour l’instant"
        description="Chaque appel qualifié par Sophie créera automatiquement une fiche ici : Nouveau, À traiter, RDV, Client, Terminé, Perdu."
      />
    </div>
  );
}
