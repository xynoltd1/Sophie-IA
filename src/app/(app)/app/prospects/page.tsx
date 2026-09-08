import { SectionTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";

export const metadata = { title: "Prospects — Sophie IA" };

export default function ProspectsPage() {
  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Prospects</SectionTitle>
      <EmptyState
        title="Aucun prospect pour l’instant"
        description="Chaque appel qualifie par Sophie creera automatiquement une fiche ici : Nouveau, A traiter, RDV, Client, Termine, Perdu."
      />
    </div>
  );
}
